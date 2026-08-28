import { useState, useEffect, useRef } from 'react';
import { Star, Plus, Trash2, Loader2, GripVertical, Upload, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useSatisfactionSurvey, type SurveyQuestion } from '@/hooks/useSatisfactionSurvey';
import { useUserOrganization } from '@/hooks/useOrganization';

export function SatisfactionSettingsCard() {
  const { survey, isLoading, upsertSurvey } = useSatisfactionSurvey();
  const { data: orgData } = useUserOrganization();

  const [title, setTitle] = useState('Pesquisa de Satisfação');
  const [description, setDescription] = useState('Queremos saber como foi seu atendimento!');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [thankYouMessage, setThankYouMessage] = useState('Obrigado pela sua avaliação! 🎉');
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    { id: 'rating', type: 'stars', label: 'Como você avalia o atendimento?', required: true },
    { id: 'comment', type: 'text', label: 'Deixe um comentário (opcional)', required: false },
  ]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (survey) {
      setTitle(survey.title);
      setDescription(survey.description || '');
      setLogoUrl(survey.logo_url || '');
      setPrimaryColor(survey.primary_color);
      setThankYouMessage(survey.thank_you_message);
      setIsActive(survey.is_active);
      setQuestions(survey.questions);
    }
  }, [survey]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    setUploading(true);
    try {
      const orgId = orgData?.organization?.id;
      if (!orgId) {
        toast.error('Organização não encontrada');
        setUploading(false);
        return;
      }
      const ext = file.name.split('.').pop();
      const fileName = `${orgId}/logo_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('survey-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('survey-logos')
        .getPublicUrl(fileName);

      setLogoUrl(urlData.publicUrl);
      toast.success('Logo enviado com sucesso!');
    } catch {
      toast.error('Erro ao enviar logo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeLogo = () => setLogoUrl('');

  const handleSave = async () => {
    try {
      await upsertSurvey.mutateAsync({
        title,
        description,
        logo_url: logoUrl || null,
        primary_color: primaryColor,
        thank_you_message: thankYouMessage,
        is_active: isActive,
        questions,
      });
      toast.success('Configurações da pesquisa salvas!');
    } catch {
      toast.error('Erro ao salvar configurações');
    }
  };

  const addQuestion = () => {
    const id = `q_${Date.now()}`;
    setQuestions([...questions, { id, type: 'text', label: '', required: false }]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, field: keyof SurveyQuestion, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Pesquisa de Satisfação
            </CardTitle>
            <CardDescription>
              Personalize o formulário que seus clientes receberão após o atendimento
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="survey-active" className="text-sm">Ativa</Label>
            <Switch id="survey-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Branding */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Título da Pesquisa</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cor Principal</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-14 h-10 p-1 cursor-pointer"
              />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descrição</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {/* Logo Upload */}
        <div className="space-y-2">
          <Label>Logo da Pesquisa</Label>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <div className="relative group">
                <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-xl object-contain bg-muted p-1 border" />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {logoUrl ? 'Trocar Logo' : 'Enviar Logo'}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG. Máx 2MB.</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mensagem de Agradecimento</Label>
          <Textarea value={thankYouMessage} onChange={(e) => setThankYouMessage(e.target.value)} rows={2} />
        </div>

        {/* Questions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Perguntas</Label>
            <Button variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
          </div>

          {questions.map((q, idx) => (
            <div key={q.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Pergunta {idx + 1}</span>
                <div className="flex-1" />
                {questions.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <Label className="text-xs">Pergunta</Label>
                  <Input
                    value={q.label}
                    onChange={(e) => updateQuestion(q.id, 'label', e.target.value)}
                    placeholder="Ex: Como foi o atendimento?"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={q.type} onValueChange={(v) => updateQuestion(q.id, 'type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stars">⭐ Estrelas (1-5)</SelectItem>
                      <SelectItem value="emoji">😊 Emojis</SelectItem>
                      <SelectItem value="nps">📊 NPS (0-10)</SelectItem>
                      <SelectItem value="multiple_choice">☑️ Múltipla Escolha</SelectItem>
                      <SelectItem value="text">✏️ Texto Livre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {q.type === 'multiple_choice' && (
                <div className="space-y-2 pl-6 border-l-2 border-muted">
                  <Label className="text-xs">Alternativas</Label>
                  {(q.options || []).map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5">{String.fromCharCode(65 + optIdx)})</span>
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...(q.options || [])];
                          newOptions[optIdx] = e.target.value;
                          updateQuestion(q.id, 'options', newOptions);
                        }}
                        placeholder={`Alternativa ${String.fromCharCode(65 + optIdx)}`}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const newOptions = (q.options || []).filter((_, i) => i !== optIdx);
                          updateQuestion(q.id, 'options', newOptions);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newOptions = [...(q.options || []), ''];
                      updateQuestion(q.id, 'options', newOptions);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar alternativa
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch checked={q.required} onCheckedChange={(v) => updateQuestion(q.id, 'required', v)} />
                <Label className="text-sm">Obrigatória</Label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={upsertSurvey.isPending}>
            {upsertSurvey.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
