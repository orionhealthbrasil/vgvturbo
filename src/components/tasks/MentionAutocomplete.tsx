import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOrganizationMembers, type OrganizationMemberWithProfile } from '@/hooks/useOrganization';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (value: string, mentions: string[]) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
  onSubmit?: () => void;
}

interface MentionToken {
  display: string; // e.g. "@João Silva"
  user_id: string;
}

/**
 * Textarea com autocomplete de @menção. Mantém o controle do texto e devolve
 * tanto o conteúdo quanto a lista de user_ids citados.
 */
export function MentionAutocomplete({
  value,
  onChange,
  placeholder,
  rows = 2,
  className,
  disabled,
  onSubmit,
}: Props) {
  const { data: members = [] } = useOrganizationMembers();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // tokens already inserted (so we know which user_ids to send)
  const tokensRef = useRef<MentionToken[]>([]);

  const extractMentionsFromText = (text: string): string[] => {
    const ids: string[] = [];
    tokensRef.current.forEach((t) => {
      if (text.includes(t.display) && !ids.includes(t.user_id)) ids.push(t.user_id);
    });
    return ids;
  };

  const filtered = members
    .filter((m) => {
      const name = (m.full_name ?? m.email ?? '').toLowerCase();
      return name.includes(query.toLowerCase());
    })
    .slice(0, 6);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursor = e.target.selectionStart ?? text.length;
    // find last "@" before cursor
    const before = text.slice(0, cursor);
    const atIdx = before.lastIndexOf('@');
    if (atIdx >= 0) {
      const slice = before.slice(atIdx + 1);
      // open if it doesn't contain whitespace and is short
      if (!/\s/.test(slice) && slice.length <= 30 && (atIdx === 0 || /\s/.test(before[atIdx - 1] ?? ' '))) {
        setOpen(true);
        setQuery(slice);
        setMentionStart(atIdx);
        setActiveIdx(0);
      } else {
        setOpen(false);
        setMentionStart(null);
      }
    } else {
      setOpen(false);
      setMentionStart(null);
    }
    onChange(text, extractMentionsFromText(text));
  };

  const insertMention = (member: OrganizationMemberWithProfile) => {
    if (mentionStart === null || !taRef.current) return;
    const ta = taRef.current;
    const cursor = ta.selectionStart ?? value.length;
    const display = `@${member.full_name ?? member.email ?? 'user'}`;
    tokensRef.current.push({ display, user_id: member.user_id });
    const newText = value.slice(0, mentionStart) + display + ' ' + value.slice(cursor);
    onChange(newText, extractMentionsFromText(newText));
    setOpen(false);
    setMentionStart(null);
    setQuery('');
    requestAnimationFrame(() => {
      const pos = mentionStart + display.length + 1;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filtered[activeIdx]);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  useEffect(() => {
    // reset tokens when value cleared externally
    if (value === '') tokensRef.current = [];
  }, [value]);

  return (
    <div className="relative w-full">
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className,
        )}
      />
      {open && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 z-50 w-64 rounded-md border bg-popover shadow-md p-1 max-h-56 overflow-y-auto">
          {filtered.map((m, i) => (
            <button
              key={m.user_id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(m);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm',
                i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
              )}
            >
              <Avatar className="w-6 h-6">
                <AvatarImage src={m.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {(m.full_name ?? m.email ?? '?').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{m.full_name ?? 'Sem nome'}</div>
                {m.email && <div className="truncate text-xs text-muted-foreground">{m.email}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Renderiza texto destacando @menções como chips. */
export function renderMentions(text: string) {
  // simple: highlight @Word(s) up to a punctuation/space — not perfect but good enough
  const parts = text.split(/(@[\p{L}\p{N}_][\p{L}\p{N}_ ]{0,40})/gu);
  return parts.map((p, i) => {
    if (p.startsWith('@')) {
      return (
        <span
          key={i}
          className="bg-primary/10 text-primary rounded px-1 font-medium"
        >
          {p.trim()}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
