import { useState } from 'react';
import { Plus, Trash2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreatePoll } from '@/hooks/useInternalPolls';
import { toast } from 'sonner';

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

export function CreatePollDialog({ open, onOpenChange, conversationId }: CreatePollDialogProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);

  const createPoll = useCreatePoll();

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    const trimmedQuestion = question.trim();
    const validOptions = options.map(o => o.trim()).filter(o => o.length > 0);

    if (!trimmedQuestion) {
      toast.error('Digite uma pergunta para a enquete');
      return;
    }

    if (validOptions.length < 2) {
      toast.error('Adicione pelo menos 2 opções');
      return;
    }

    try {
      await createPoll.mutateAsync({
        conversationId,
        question: trimmedQuestion,
        options: validOptions,
        isAnonymous,
        isMultipleChoice
      });

      toast.success('Enquete criada com sucesso!');
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating poll:', error);
      toast.error('Erro ao criar enquete');
    }
  };

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setIsAnonymous(false);
    setIsMultipleChoice(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Criar Enquete
          </DialogTitle>
          <DialogDescription>
            Crie uma votação para os membros do grupo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question */}
          <div className="space-y-2">
            <Label htmlFor="question">Pergunta</Label>
            <Input
              id="question"
              placeholder="Ex: Qual o melhor horário para a reunião?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label>Opções</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder={`Opção ${index + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(index)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar opção
              </Button>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="anonymous" className="text-sm font-normal">
                Votação anônima
              </Label>
              <Switch
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="multiple" className="text-sm font-normal">
                Permitir múltipla escolha
              </Label>
              <Switch
                id="multiple"
                checked={isMultipleChoice}
                onCheckedChange={setIsMultipleChoice}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createPoll.isPending}>
            {createPoll.isPending ? 'Criando...' : 'Criar enquete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
