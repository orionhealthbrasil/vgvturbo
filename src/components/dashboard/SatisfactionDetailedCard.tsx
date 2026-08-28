import { useState } from 'react';
import { Star, ChevronDown, ChevronUp, MessageSquareText, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSatisfactionDetailedStats, type QuestionStats } from '@/hooks/useSatisfactionDetailedStats';
import { Skeleton } from '@/components/ui/skeleton';

function DistributionBar({ stats }: { stats: QuestionStats }) {
  const maxVal = stats.type === 'nps' ? 10 : 5;
  const minVal = stats.type === 'nps' ? 0 : 1;
  const entries = [];
  for (let i = maxVal; i >= minVal; i--) {
    entries.push({ value: i, count: stats.distribution[i] || 0 });
  }
  const maxCount = Math.max(...entries.map(e => e.count), 1);

  const getLabel = (val: number) => {
    if (stats.type === 'emoji') {
      const emojis: Record<number, string> = { 1: '😡', 2: '😞', 3: '😐', 4: '😊', 5: '🤩' };
      return emojis[val] || val;
    }
    if (stats.type === 'stars') return '⭐'.repeat(val);
    return val.toString();
  };

  return (
    <div className="space-y-1.5">
      {entries.map(({ value, count }) => {
        const pct = stats.count > 0 ? Math.round((count / stats.count) * 100) : 0;
        return (
          <div key={value} className="flex items-center gap-2 text-sm">
            <span className="w-16 text-right text-xs text-muted-foreground truncate">
              {stats.type === 'stars' ? `${value} ⭐` : stats.type === 'emoji' ? getLabel(value) : value}
            </span>
            <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/80 transition-all"
                style={{ width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }}
              />
            </div>
            <span className="w-16 text-xs text-muted-foreground">
              {count} ({pct}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NumericQuestionCard({ stats }: { stats: QuestionStats }) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{stats.label}</h4>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {stats.count} respostas
          </Badge>
          <span className="text-lg font-bold text-primary">
            {stats.average}/{stats.type === 'nps' ? '10' : '5'}
          </span>
        </div>
      </div>
      <DistributionBar stats={stats} />
    </div>
  );
}

function TextResponsesTable({ stats }: { stats: QuestionStats }) {
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');

  const agents = [...new Set(stats.textResponses.map(r => r.assignedTo).filter(Boolean))] as string[];

  const filtered = stats.textResponses.filter(r => {
    if (search && !r.text.toLowerCase().includes(search.toLowerCase()) && 
        !(r.contactName || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (agentFilter !== 'all' && r.assignedTo !== agentFilter) return false;
    return true;
  });

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <MessageSquareText className="w-4 h-4" />
          {stats.label}
        </h4>
        <Badge variant="secondary" className="text-xs">{stats.count} respostas</Badge>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Buscar por texto ou contato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 h-8 text-xs"
        />
        {agents.length > 0 && (
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {agents.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="max-h-[300px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Contato</TableHead>
                <TableHead className="text-xs">Resposta</TableHead>
                <TableHead className="text-xs">Vendedor</TableHead>
                <TableHead className="text-xs">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 50).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">{r.contactName || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[300px] truncate">{r.text}</TableCell>
                  <TableCell className="text-xs">{r.assignedTo || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.submittedAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 50 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Mostrando 50 de {filtered.length} respostas
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma resposta encontrada</p>
      )}
    </div>
  );
}

export function SatisfactionDetailedCard() {
  const { questionStats, isLoading, hasData } = useSatisfactionDetailedStats();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-20" />;
  }

  if (!hasData || questionStats.length === 0) return null;

  const numericStats = questionStats.filter(q => q.type !== 'text');
  const textStats = questionStats.filter(q => q.type === 'text');

  // Overall average across all numeric questions
  const overallAvg = numericStats.length > 0
    ? Math.round((numericStats.reduce((sum, q) => sum + q.average, 0) / numericStats.length) * 10) / 10
    : 0;
  const totalResponses = Math.max(...questionStats.map(q => q.count), 0);

  return (
    <Card className="glass-card">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5 text-primary" />
            Satisfação por Pergunta
            <Badge variant="outline" className="ml-2 text-xs font-normal">
              {totalResponses} avaliações · Média geral {overallAvg}/5
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Numeric questions */}
          {numericStats.map(q => (
            <NumericQuestionCard key={q.questionId} stats={q} />
          ))}

          {/* Text responses */}
          {textStats.map(q => (
            <TextResponsesTable key={q.questionId} stats={q} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
