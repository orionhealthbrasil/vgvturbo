import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, BarChart3, MessageSquareText, MessageCircle, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';
import type { SurveyQuestion } from '@/hooks/useSatisfactionSurvey';

interface ResponseEntry {
  responseId?: string;
  contactId: string | null;
  contactName: string | null;
  assignedTo: string | null;
  submittedAt: string;
  rating: number | null;
  text?: string;
}

interface QuestionStat {
  questionId: string;
  label: string;
  type: 'stars' | 'text' | 'emoji' | 'nps' | 'multiple_choice';
  average: number;
  count: number;
  distribution: Record<number, number>;
  responses: ResponseEntry[];
}

interface SatisfactionAnalyticsProps {
  isViewer: boolean;
  isAnalystOrHigher: boolean;
}

export function SatisfactionAnalytics({ isViewer, isAnalystOrHigher }: SatisfactionAnalyticsProps) {
  const { user } = useAuth();
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const queryClient = useQueryClient();

  const [selectedAgent, setSelectedAgent] = useState('all');

  // Fetch survey config
  const { data: survey } = useQuery({
    queryKey: ['satisfaction-survey-config', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .select('questions')
        .eq('organization_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return (data.questions as unknown as SurveyQuestion[]) || [];
    },
    enabled: !!orgId,
  });

  // Fetch all submitted responses
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['satisfaction-analytics', orgId],
    queryFn: async () => {
      let allResponses: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('satisfaction_responses')
          .select('id, answers, rating, submitted_at, assigned_to, contact_id')
          .eq('organization_id', orgId!)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allResponses = allResponses.concat(data);
        if (data.length < pageSize) break;
        page++;
      }

      // Fetch contact names
      const contactIds = [...new Set(allResponses.map(r => r.contact_id).filter(Boolean))];
      let contactMap: Record<string, string> = {};
      if (contactIds.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < contactIds.length; i += batchSize) {
          const batch = contactIds.slice(i, i + batchSize);
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, name')
            .in('id', batch);
          if (contacts) {
            for (const c of contacts) contactMap[c.id] = c.name;
          }
        }
      }

      // Fetch assigned_to profiles
      const assignedIds = [...new Set(allResponses.map(r => r.assigned_to).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', assignedIds);
        if (profiles) {
          for (const p of profiles) profileMap[p.user_id] = p.full_name || 'Sem nome';
        }
      }

      return { allResponses, contactMap, profileMap };
    },
    enabled: !!orgId,
  });

  // Filter responses based on role
  const filteredResponses = useMemo(() => {
    if (!rawData) return [];
    let responses = rawData.allResponses;

    // Viewer: only their own
    if (isViewer && user?.id) {
      responses = responses.filter(r => r.assigned_to === user.id);
    }

    // Agent filter (for analyst/owner)
    if (selectedAgent !== 'all' && isAnalystOrHigher) {
      responses = responses.filter(r => r.assigned_to === selectedAgent);
    }

    return responses;
  }, [rawData, isViewer, isAnalystOrHigher, selectedAgent, user?.id]);

  // Available agents for selector
  const agents = useMemo(() => {
    if (!rawData || !isAnalystOrHigher) return [];
    const agentIds = [...new Set(rawData.allResponses.map(r => r.assigned_to).filter(Boolean))];
    return agentIds.map(id => ({
      id,
      name: rawData.profileMap[id] || 'Sem nome',
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawData, isAnalystOrHigher]);

  // Build per-question stats
  const questionStats: QuestionStat[] = useMemo(() => {
    if (!survey || !rawData) return [];

    const currentQuestionIds = new Set(survey.map(q => q.id));

    const stats = survey.map(q => {
      const stat: QuestionStat = {
        questionId: q.id,
        label: q.label,
        type: q.type,
        average: 0,
        count: 0,
        distribution: {},
        responses: [],
      };

      if (q.type === 'text') {
        for (const r of filteredResponses) {
          const answers = r.answers as Record<string, any> | null;
          const text = answers?.[q.id];
          if (text && typeof text === 'string' && text.trim()) {
            stat.responses.push({
              responseId: r.id,
              text: text.trim(),
              contactId: r.contact_id || null,
              contactName: r.contact_id ? (rawData.contactMap[r.contact_id] || null) : null,
              assignedTo: r.assigned_to ? (rawData.profileMap[r.assigned_to] || null) : null,
              submittedAt: r.submitted_at,
              rating: r.rating,
            });
            stat.count++;
          }
        }
      } else {
        const maxVal = q.type === 'nps' ? 10 : 5;
        for (let i = (q.type === 'nps' ? 0 : 1); i <= maxVal; i++) stat.distribution[i] = 0;

        let total = 0;
        for (const r of filteredResponses) {
          const answers = r.answers as Record<string, any> | null;
          const val = answers?.[q.id];
          if (val !== undefined && val !== null && typeof val === 'number') {
            total += val;
            stat.count++;
            stat.distribution[val] = (stat.distribution[val] || 0) + 1;
            stat.responses.push({
              responseId: r.id,
              contactId: r.contact_id || null,
              contactName: r.contact_id ? (rawData.contactMap[r.contact_id] || null) : null,
              assignedTo: r.assigned_to ? (rawData.profileMap[r.assigned_to] || null) : null,
              submittedAt: r.submitted_at,
              rating: val,
            });
          }
        }
        stat.average = stat.count > 0 ? Math.round((total / stat.count) * 10) / 10 : 0;
      }

      return stat;
    });

    // Recover orphaned text responses (from questions that were moved/recreated with new IDs)
    const orphanedTexts: Map<string, ResponseEntry[]> = new Map();
    for (const r of filteredResponses) {
      const answers = r.answers as Record<string, any> | null;
      if (!answers) continue;
      for (const [key, value] of Object.entries(answers)) {
        if (currentQuestionIds.has(key)) continue;
        if (typeof value === 'string' && value.trim()) {
          if (!orphanedTexts.has(key)) orphanedTexts.set(key, []);
          orphanedTexts.get(key)!.push({
            responseId: r.id,
            text: value.trim(),
            contactId: r.contact_id || null,
            contactName: r.contact_id ? (rawData.contactMap[r.contact_id] || null) : null,
            assignedTo: r.assigned_to ? (rawData.profileMap[r.assigned_to] || null) : null,
            submittedAt: r.submitted_at,
            rating: r.rating,
          });
        }
      }
    }

    // Add orphaned text groups as recovered question stats
    for (const [key, responses] of orphanedTexts.entries()) {
      if (responses.length > 0) {
        stats.push({
          questionId: key,
          label: `📋 Respostas recuperadas (pergunta anterior)`,
          type: 'text',
          average: 0,
          count: responses.length,
          distribution: {},
          responses,
        });
      }
    }

    return stats;
  }, [survey, filteredResponses, rawData]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!rawData || rawData.allResponses.length === 0 || !survey || survey.length === 0) {
    return null;
  }

  const currentQuestionIds = new Set(survey.map(q => q.id));
  const numericStats = questionStats.filter(q => q.type !== 'text');
  const textStats = questionStats.filter(q => q.type === 'text');

  const numericWithResponses = numericStats.filter(q => q.count > 0);
  const overallAvg = numericWithResponses.length > 0
    ? Math.round((numericWithResponses.reduce((sum, q) => sum + q.average, 0) / numericWithResponses.length) * 10) / 10
    : 0;
  const totalResponses = filteredResponses.length;

  const handleMigrateOrphans = async (orphanQuestionId: string, targetQuestionId: string) => {
    // Find all responses that have the orphan key
    const responsesToUpdate = rawData.allResponses.filter(r => {
      const answers = r.answers as Record<string, any> | null;
      return answers && answers[orphanQuestionId] !== undefined;
    });

    let updated = 0;
    for (const r of responsesToUpdate) {
      const answers = { ...(r.answers as Record<string, any>) };
      const value = answers[orphanQuestionId];
      // Only migrate if target doesn't already have a value
      if (answers[targetQuestionId] === undefined || answers[targetQuestionId] === null || answers[targetQuestionId] === '') {
        answers[targetQuestionId] = value;
      }
      delete answers[orphanQuestionId];

      const { error } = await supabase
        .from('satisfaction_responses')
        .update({ answers: answers as any })
        .eq('id', r.id);

      if (!error) updated++;
    }

    queryClient.invalidateQueries({ queryKey: ['satisfaction-analytics'] });
    return updated;
  };

  // Get text questions from current survey for migration target selection
  const currentTextQuestions = survey.filter(q => q.type === 'text');

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5 text-primary" />
            Satisfação por Pergunta
            <Badge variant="outline" className="ml-2 text-xs font-normal">
              {totalResponses} avaliações · Média geral {overallAvg}/5
            </Badge>
          </CardTitle>

          {isAnalystOrHigher && agents.length > 0 && (
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Vendedores</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {numericStats.map(q => (
          <NumericQuestionCard key={q.questionId} stats={q} />
        ))}

        {textStats.map(q => (
          <TextResponsesTable
            key={q.questionId}
            stats={q}
            isOrphan={!currentQuestionIds.has(q.questionId)}
            targetQuestions={currentTextQuestions}
            onMigrate={handleMigrateOrphans}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function DistributionBar({ stats }: { stats: QuestionStat }) {
  const maxVal = stats.type === 'nps' ? 10 : 5;
  const minVal = stats.type === 'nps' ? 0 : 1;
  const entries = [];
  for (let i = maxVal; i >= minVal; i--) {
    entries.push({ value: i, count: stats.distribution[i] || 0 });
  }
  const maxCount = Math.max(...entries.map(e => e.count), 1);

  return (
    <div className="space-y-1.5">
      {entries.map(({ value, count }) => {
        const pct = stats.count > 0 ? Math.round((count / stats.count) * 100) : 0;
        return (
          <div key={value} className="flex items-center gap-2 text-sm">
            <span className="w-16 text-right text-xs text-muted-foreground truncate">
              {stats.type === 'stars' ? `${value} ⭐` : stats.type === 'emoji' ? ({ 1: '😡', 2: '😞', 3: '😐', 4: '😊', 5: '🤩' } as Record<number, string>)[value] || value : value}
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

function NumericQuestionCard({ stats }: { stats: QuestionStat }) {
  const navigate = useNavigate();
  const [showResponses, setShowResponses] = useState(false);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{stats.label}</h4>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{stats.count} respostas</Badge>
          <span className="text-lg font-bold text-primary">
            {stats.average}/{stats.type === 'nps' ? '10' : '5'}
          </span>
        </div>
      </div>
      <DistributionBar stats={stats} />
      
      {stats.responses.length > 0 && (
        <div>
          <button
            onClick={() => setShowResponses(!showResponses)}
            className="text-xs text-primary hover:underline"
          >
            {showResponses ? 'Ocultar detalhes' : 'Ver avaliações individuais'}
          </button>
          {showResponses && (
            <div className="max-h-[250px] overflow-y-auto mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Contato</TableHead>
                    <TableHead className="text-xs">Nota</TableHead>
                    <TableHead className="text-xs">Vendedor</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.responses.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{r.contactName || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {stats.type === 'stars' ? `${r.rating} ⭐` : stats.type === 'emoji' ? ({ 1: '😡', 2: '😞', 3: '😐', 4: '😊', 5: '🤩' } as Record<number, string>)[r.rating || 0] || r.rating : r.rating}
                      </TableCell>
                      <TableCell className="text-xs">{r.assignedTo || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.submittedAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.contactId && (
                          <button
                            onClick={() => navigate(`/chat?contact=${r.contactId}`)}
                            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                            title="Abrir conversa"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {stats.responses.length > 50 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Mostrando 50 de {stats.responses.length} avaliações
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TextResponsesTable({ stats, isOrphan, targetQuestions, onMigrate }: {
  stats: QuestionStat;
  isOrphan?: boolean;
  targetQuestions?: SurveyQuestion[];
  onMigrate?: (orphanId: string, targetId: string) => Promise<number>;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [migrating, setMigrating] = useState(false);

  const agents = [...new Set(stats.responses.map(r => r.assignedTo).filter(Boolean))] as string[];

  const filtered = stats.responses.filter(r => {
    if (search && !(r.text || '').toLowerCase().includes(search.toLowerCase()) &&
      !(r.contactName || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (agentFilter !== 'all' && r.assignedTo !== agentFilter) return false;
    return true;
  });

  const handleMigrate = async () => {
    if (!selectedTarget || !onMigrate) return;
    setMigrating(true);
    try {
      const count = await onMigrate(stats.questionId, selectedTarget);
      alert(`${count} respostas migradas com sucesso!`);
    } catch (e) {
      alert('Erro ao migrar respostas');
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${isOrphan ? 'border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/10' : ''}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <MessageSquareText className="w-4 h-4" />
          {stats.label}
        </h4>
        <Badge variant="secondary" className="text-xs">{stats.count} respostas</Badge>
      </div>

      {isOrphan && targetQuestions && targetQuestions.length > 0 && onMigrate && (
        <div className="flex items-center gap-2 p-2 bg-amber-100/50 dark:bg-amber-900/20 rounded-md border border-amber-300/50">
          <ArrowRightLeft className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-400 shrink-0">Migrar para:</span>
          <Select value={selectedTarget} onValueChange={setSelectedTarget}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue placeholder="Selecione a pergunta destino" />
            </SelectTrigger>
            <SelectContent>
              {targetQuestions.map(q => (
                <SelectItem key={q.id} value={q.id} className="text-xs">{q.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={handleMigrate}
            disabled={!selectedTarget || migrating}
            className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {migrating ? 'Migrando...' : 'Migrar'}
          </button>
        </div>
      )}

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
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 50).map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">{r.contactName || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[300px] truncate">{r.text || '—'}</TableCell>
                  <TableCell className="text-xs">{r.assignedTo || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(r.submittedAt).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.contactId && (
                      <button
                        onClick={() => navigate(`/chat?contact=${r.contactId}`)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                        title="Abrir conversa"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
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
