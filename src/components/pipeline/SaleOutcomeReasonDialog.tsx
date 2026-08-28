import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLossReasons } from '@/hooks/useLossReasons';
import { useWinReasons, useOutcomeQuestions, DEFAULT_WIN_QUESTION, DEFAULT_LOSS_QUESTION } from '@/hooks/useWinReasons';

export type OutcomeKind = 'won' | 'lost';

interface SaleOutcomeReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void> | void;
  loading?: boolean;
  kind: OutcomeKind;
}

export function SaleOutcomeReasonDialog({ open, onOpenChange, onConfirm, loading, kind }: SaleOutcomeReasonDialogProps) {
  const [selected, setSelected] = useState<string>('');
  const winQ = useWinReasons({ activeOnly: true });
  const lossQ = useLossReasons({ activeOnly: true });
  const { data: questions } = useOutcomeQuestions();

  const isWon = kind === 'won';
  const reasons = isWon ? winQ.data ?? [] : lossQ.data ?? [];
  const isLoading = isWon ? winQ.isLoading : lossQ.isLoading;
  const question = isWon
    ? (questions?.win || DEFAULT_WIN_QUESTION)
    : (questions?.loss || DEFAULT_LOSS_QUESTION);

  useEffect(() => {
    if (!open) setSelected('');
  }, [open]);

  const handleConfirm = async () => {
    if (!selected) return;
    await onConfirm(selected);
    setSelected('');
  };

  const title = isWon ? '🏆 Venda Realizada' : 'Motivo da perda';
  const settingsHash = isWon ? 'ganhos' : 'perdas';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{question}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando motivos...</p>
          ) : reasons.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground space-y-2">
              <p>Nenhum motivo cadastrado.</p>
              <Link
                to={`/organizacao?section=${settingsHash}`}
                className="text-primary underline underline-offset-2"
                onClick={() => onOpenChange(false)}
              >
                Cadastrar motivos em Configurações
              </Link>
            </div>
          ) : (
            <RadioGroup value={selected} onValueChange={setSelected} className="space-y-1.5">
              {reasons.map((r) => (
                <label
                  key={r.id}
                  htmlFor={`outcome-${r.id}`}
                  className="flex items-center gap-3 rounded-md border border-border/60 p-3 cursor-pointer hover:bg-accent/40 transition-colors data-[state=checked]:border-primary"
                  data-state={selected === r.label ? 'checked' : 'unchecked'}
                >
                  <RadioGroupItem value={r.label} id={`outcome-${r.id}`} />
                  {r.color && (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: r.color }}
                    />
                  )}
                  <Label htmlFor={`outcome-${r.id}`} className="cursor-pointer font-normal flex-1">
                    {r.label}
                  </Label>
                </label>
              ))}
            </RadioGroup>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected || loading || reasons.length === 0}
            className={isWon ? 'bg-emerald-600 hover:bg-emerald-600/90 text-white' : ''}
            variant={isWon ? 'default' : 'destructive'}
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {isWon ? 'Confirmar venda' : 'Confirmar perda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
