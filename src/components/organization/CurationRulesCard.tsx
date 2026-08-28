import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Trash2, Sparkles } from 'lucide-react';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useCurationRules, useCurationExamples } from '@/hooks/useAnalysisCuration';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export function CurationRulesCard() {
  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization?.id;
  const { rules, saveRules, isSaving } = useCurationRules(orgId);
  const { examples, removeExample } = useCurationExamples(orgId);
  const [text, setText] = useState('');

  useEffect(() => {
    setText(rules?.rules_text || '');
  }, [rules?.id]);

  const handleSave = async () => {
    try {
      await saveRules(text);
      toast.success('Regras de curadoria salvas');
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e.message || e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Curadoria de Análises de Conversa
        </CardTitle>
        <CardDescription>
          Diretrizes que a IA seguirá ao gerar análises. Toda correção feita na tela de análises vira um exemplo de aprendizado abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Diretrizes (texto livre)</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={`Ex.:\n- Se o cliente pediu orçamento mas não respondeu, marcar como ORCAMENTO (não SEM RESPOSTA).\n- Sempre extrair o telefone com DDD.\n- Considerar "filtro de óleo" como LINHA LEVE quando não houver outra indicação.`}
          />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar regras'}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Exemplos de aprendizado</h3>
            <Badge variant="secondary">{examples.length}</Badge>
          </div>
          {examples.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
              Nenhum exemplo ainda. Edite uma análise errada na tela "Análises de Conversa" para criar um exemplo automaticamente.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {examples.map((ex) => (
                <div key={ex.id} className="border rounded-md p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {format(parseISO(ex.created_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeExample(ex.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  {ex.note && <p className="italic text-muted-foreground">"{ex.note}"</p>}
                  {ex.wrong_values && (
                    <div><span className="text-destructive font-medium">Errado:</span> {JSON.stringify(ex.wrong_values)}</div>
                  )}
                  <div><span className="text-green-600 font-medium">Correto:</span> {JSON.stringify(ex.correct_values)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
