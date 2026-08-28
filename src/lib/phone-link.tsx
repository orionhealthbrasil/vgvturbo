import React from 'react';

/**
 * Regex patterns to match Brazilian phone numbers in various formats:
 * - Plain: 79991658966
 * - With parentheses: (79) 99165-8966
 * - With country code: +55 79 99165-8966
 * - Mixed formats: +55 (79) 99165-8966, 55 79 991658966, etc.
 */
const PHONE_PATTERNS = [
  // +55 (XX) XXXXX-XXXX or +55 (XX) XXXX-XXXX
  /\+55\s*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g,
  // 55 (XX) XXXXX-XXXX or 55 XX XXXXX-XXXX (without +)
  /\b55\s*\(?\d{2}\)?\s*\d{4,5}[-.\s]?\d{4}/g,
  // (XX) XXXXX-XXXX or (XX) XXXX-XXXX
  /\(\d{2}\)\s*\d{4,5}[-.\s]?\d{4}/g,
  // XX XXXXX-XXXX or XX XXXX-XXXX (with space/dash between DDD and number)
  /\b[1-9][1-9]\s+\d{4,5}[-.\s]?\d{4}\b/g,
  // Plain 10-11 digits: XXXXXXXXXXX
  /\b[1-9][1-9]\d{8,9}\b/g,
];

/**
 * Combined regex that matches all phone formats
 */
const COMBINED_PHONE_REGEX = new RegExp(
  PHONE_PATTERNS.map(r => r.source).join('|'),
  'g'
);

/**
 * Extracts only digits from a phone string and normalizes to Brazilian format.
 * Applies 9th-digit logic for mobile numbers to prevent duplicates.
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  // If it's 10-11 digits, assume it's Brazilian without country code
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  // If it already has 55 prefix (12-13 digits)
  if (!digits.startsWith('55')) {
    return digits;
  }
  // Apply 9th digit normalization for Brazilian mobile numbers
  const withoutCountry = digits.slice(2);
  if (withoutCountry.length === 10) {
    const ddd = withoutCountry.slice(0, 2);
    const number = withoutCountry.slice(2);
    const firstDigit = number[0];
    // Mobile numbers start with 6-9 after DDD, add the 9
    if (['6', '7', '8', '9'].includes(firstDigit)) {
      return `55${ddd}9${number}`;
    }
  }
  return digits;
}

/**
 * Parses text content and converts Brazilian phone numbers into clickable elements
 */
export function linkifyPhoneNumbers(
  text: string,
  onPhoneClick?: (phone: string) => void
): React.ReactNode {
  if (!text) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  COMBINED_PHONE_REGEX.lastIndex = 0;

  // Collect all matches first to avoid overlapping
  const matches: { match: string; index: number }[] = [];
  
  while ((match = COMBINED_PHONE_REGEX.exec(text)) !== null) {
    matches.push({ match: match[0], index: match.index });
  }

  // Remove overlapping matches (keep the first/longest one)
  const filteredMatches = matches.filter((m, i) => {
    for (let j = 0; j < i; j++) {
      const prev = matches[j];
      const prevEnd = prev.index + prev.match.length;
      // Check if current match overlaps with previous
      if (m.index < prevEnd && m.index >= prev.index) {
        return false;
      }
    }
    return true;
  });

  for (const { match: fullMatch, index: matchStart } of filteredMatches) {
    // Add text before the match
    if (matchStart > lastIndex) {
      parts.push(text.slice(lastIndex, matchStart));
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(fullMatch);

    if (onPhoneClick) {
      // Interactive: clickable span that triggers callback
      parts.push(
        <button
          key={`phone-${matchStart}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPhoneClick(normalizedPhone);
          }}
          className="underline underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer font-medium break-words [overflow-wrap:anywhere]"
          title={`Abrir conversa com ${fullMatch}`}
        >
          {fullMatch}
        </button>
      );
    } else {
      // Fallback: open WhatsApp Web
      parts.push(
        <a
          key={`phone-${matchStart}`}
          href={`https://wa.me/${normalizedPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer break-words [overflow-wrap:anywhere]"
          onClick={(e) => e.stopPropagation()}
          title={`Abrir conversa com ${fullMatch}`}
        >
          {fullMatch}
        </a>
      );
    }

    lastIndex = matchStart + fullMatch.length;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no matches found, return original text
  if (parts.length === 0) {
    return text;
  }

  return <>{parts}</>;
}
