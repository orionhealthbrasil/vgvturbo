import React from 'react';
import { normalizePhone } from './phone-link';

/**
 * URL matcher:
 * - http(s)://...
 * - www.dominio.tld/...
 * - dominio.tld/path (bare) — requires a path or query to avoid catching arbitrary text like "node.js"
 *
 * Trailing punctuation (. , ; : ! ? ) ] }) is stripped after the match.
 */
const URL_REGEX =
  /\b((?:https?:\/\/|www\.)[^\s<]+|[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|co|app|dev|br|me|ai|xyz|tech|store|shop|site|online|cloud|page|link|tv|gg)(?:\.[a-z]{2})?(?:\/[^\s<]*)?)/gi;

/**
 * Brazilian phone patterns (mirrors phone-link.tsx)
 */
const PHONE_REGEX = new RegExp(
  [
    /\+55\s*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/.source,
    /\b55\s*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/.source,
    /\(\d{2}\)\s*\d{4,5}[-.\s]?\d{4}/.source,
    /\b[1-9][1-9]\s+\d{4,5}[-.\s]?\d{4}\b/.source,
    /\b[1-9][1-9]\d{8,9}\b/.source,
  ].join('|'),
  'g'
);

type Match = {
  kind: 'url' | 'phone';
  index: number;
  length: number;
  text: string;
};

function stripTrailingPunct(match: string): string {
  // Balance parentheses: only strip closing ) if there is no matching (
  let end = match.length;
  while (end > 0) {
    const ch = match[end - 1];
    if ('.,;:!?'.includes(ch)) {
      end--;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      const open = ch === ')' ? '(' : ch === ']' ? '[' : '{';
      const opens = (match.slice(0, end).match(new RegExp(`\\${open}`, 'g')) || []).length;
      const closes = (match.slice(0, end).match(new RegExp(`\\${ch}`, 'g')) || []).length;
      if (closes > opens) {
        end--;
        continue;
      }
    }
    break;
  }
  return match.slice(0, end);
}

function normalizeHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function collectMatches(text: string): Match[] {
  const matches: Match[] = [];

  URL_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_REGEX.exec(text)) !== null) {
    const raw = m[0];
    const clean = stripTrailingPunct(raw);
    if (!clean) continue;
    matches.push({ kind: 'url', index: m.index, length: clean.length, text: clean });
  }

  PHONE_REGEX.lastIndex = 0;
  while ((m = PHONE_REGEX.exec(text)) !== null) {
    matches.push({ kind: 'phone', index: m.index, length: m[0].length, text: m[0] });
  }

  // Sort: URLs win over phones on overlap; then by index, longer first
  matches.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    if (a.kind !== b.kind) return a.kind === 'url' ? -1 : 1;
    return b.length - a.length;
  });

  // Drop overlaps
  const result: Match[] = [];
  let cursor = -1;
  for (const match of matches) {
    if (match.index < cursor) continue;
    result.push(match);
    cursor = match.index + match.length;
  }
  return result;
}

export interface LinkifyOptions {
  onPhoneClick?: (phone: string) => void;
  linkClassName?: string;
}

const DEFAULT_LINK_CLASS =
  'underline underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer font-medium break-all [overflow-wrap:anywhere] inline-block max-w-full';

export function linkifyText(text: string | null | undefined, opts: LinkifyOptions = {}): React.ReactNode {
  if (!text) return text ?? null;

  const matches = collectMatches(text);
  if (matches.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, i) => {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const key = `${match.kind}-${match.index}-${i}`;
    if (match.kind === 'url') {
      const href = normalizeHref(match.text);
      parts.push(
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={opts.linkClassName ?? DEFAULT_LINK_CLASS}
          onClick={(e) => e.stopPropagation()}
          title={href}
        >
          {match.text}
        </a>
      );
    } else {
      const normalized = normalizePhone(match.text);
      if (opts.onPhoneClick) {
        parts.push(
          <button
            key={key}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              opts.onPhoneClick!(normalized);
            }}
            className={opts.linkClassName ?? DEFAULT_LINK_CLASS}
            title={`Abrir conversa com ${match.text}`}
          >
            {match.text}
          </button>
        );
      } else {
        parts.push(
          <a
            key={key}
            href={`https://wa.me/${normalized}`}
            target="_blank"
            rel="noopener noreferrer"
            className={opts.linkClassName ?? DEFAULT_LINK_CLASS}
            onClick={(e) => e.stopPropagation()}
            title={`Abrir conversa com ${match.text}`}
          >
            {match.text}
          </a>
        );
      }
    }

    lastIndex = match.index + match.length;
  });

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
