import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
}

interface MessageSearchProps {
  contactId: string;
  onResultSelect: (messageId: string) => void;
  onClose: () => void;
}

export function MessageSearch({ contactId, onResultSelect, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 400);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search in database when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.trim().length < 2) {
      setResults([]);
      setCurrentIndex(0);
      return;
    }

    let cancelled = false;

    const searchMessages = async () => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id, content, created_at')
          .eq('contact_id', contactId)
          .or(`content.ilike.% ${debouncedQuery.trim()}%,content.ilike.${debouncedQuery.trim()}%`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (error) {
          console.error('[MessageSearch] Error:', error);
          setResults([]);
          return;
        }

        setResults(data || []);
        setCurrentIndex(0);

        // Navigate to first result
        if (data && data.length > 0) {
          onResultSelect(data[0].id);
        }
      } catch (err) {
        console.error('[MessageSearch] Error:', err);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };

    searchMessages();
    return () => { cancelled = true; };
  }, [debouncedQuery, contactId]);

  const navigateResult = useCallback((direction: 'prev' | 'next') => {
    if (results.length === 0) return;
    
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % results.length
      : (currentIndex - 1 + results.length) % results.length;
    
    setCurrentIndex(newIndex);
    onResultSelect(results[newIndex].id);
  }, [results, currentIndex, onResultSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      navigateResult(e.shiftKey ? 'prev' : 'next');
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-card animate-in slide-in-from-top-2 duration-200">
      <Search className="w-4 h-4 text-muted-foreground shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Pesquisar mensagens..."
        className="flex-1 h-8 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
      />
      {isSearching && (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
      )}
      {!isSearching && debouncedQuery.trim().length >= 2 && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {results.length === 0
            ? 'Nenhum resultado'
            : `${currentIndex + 1} de ${results.length}`}
        </span>
      )}
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => navigateResult('prev')}
          disabled={results.length === 0}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => navigateResult('next')}
          disabled={results.length === 0}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
