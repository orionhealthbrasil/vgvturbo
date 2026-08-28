import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { usePublicSurvey, type SurveyQuestion } from '@/hooks/useSatisfactionSurvey';
import { toast } from 'sonner';

function StarRating({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110 focus:outline-none"
        >
          <Star
            className="w-10 h-10 transition-colors"
            fill={(hover || value) >= star ? color : 'transparent'}
            stroke={(hover || value) >= star ? color : '#d1d5db'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

function EmojiRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const emojis = [
    { value: 1, emoji: '😡', label: 'Péssimo' },
    { value: 2, emoji: '😞', label: 'Ruim' },
    { value: 3, emoji: '😐', label: 'Regular' },
    { value: 4, emoji: '😊', label: 'Bom' },
    { value: 5, emoji: '🤩', label: 'Excelente' },
  ];
  return (
    <div className="flex gap-4 justify-center">
      {emojis.map((e) => (
        <button
          key={e.value}
          type="button"
          onClick={() => onChange(e.value)}
          className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
            value === e.value ? 'bg-gray-100 scale-110 shadow-md' : 'hover:bg-gray-50 hover:scale-105'
          }`}
        >
          <span className="text-4xl">{e.emoji}</span>
          <span className="text-xs text-gray-500">{e.label}</span>
        </button>
      ))}
    </div>
  );
}

function NPSRating({ value, onChange, color }: { value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 justify-center flex-wrap">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="w-10 h-10 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: value === n ? color : 'transparent',
              color: value === n ? 'white' : '#6b7280',
              border: `1px solid ${value === n ? color : '#e5e7eb'}`,
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 px-1">
        <span>Nada provável</span>
        <span>Muito provável</span>
      </div>
    </div>
  );
}

export default function SatisfactionSurvey() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading } = usePublicSurvey(token || '');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-gray-700">Pesquisa não encontrada</p>
          <p className="text-gray-500">Este link pode ter expirado ou ser inválido.</p>
        </div>
      </div>
    );
  }

  if (data.response.submitted_at || submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md px-6">
          <CheckCircle2 className="w-16 h-16 mx-auto" style={{ color: data.survey.primary_color }} />
          <h2 className="text-2xl font-bold text-foreground">{data.survey.thank_you_message}</h2>
        </div>
      </div>
    );
  }

  const { survey } = data;
  const primaryColor = survey.primary_color || '#6366f1';

  const handleSubmit = async () => {
    const ratingQuestion = survey.questions.find(q => q.type === 'stars' || q.type === 'emoji' || q.type === 'nps');
    const ratingValue = ratingQuestion ? answers[ratingQuestion.id] : null;

    if (ratingQuestion?.required && !ratingValue) {
      toast.error('Por favor, avalie o atendimento');
      return;
    }

    // Validate required fields
    for (const q of survey.questions) {
      if (q.required && !answers[q.id]) {
        toast.error(`Por favor, responda: ${q.label}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // Normalize rating to 1-5 scale for NPS
      let normalizedRating = ratingValue;
      if (ratingQuestion?.type === 'nps' && ratingValue !== null) {
        normalizedRating = Math.round((ratingValue / 10) * 5);
        if (normalizedRating < 1) normalizedRating = 1;
      }

      const { data: submittedOk, error } = await supabase.rpc('submit_public_satisfaction_survey' as any, {
        p_token: token!,
        p_rating: normalizedRating,
        p_answers: answers,
      } as any);

      if (error) throw error;
      if (!submittedOk) throw new Error('submit-failed');
      setSubmitted(true);
    } catch (err) {
      toast.error('Erro ao enviar avaliação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: SurveyQuestion) => {
    switch (question.type) {
      case 'stars':
        return (
          <StarRating
            value={answers[question.id] || 0}
            onChange={(v) => setAnswers({ ...answers, [question.id]: v })}
            color={primaryColor}
          />
        );
      case 'emoji':
        return (
          <EmojiRating
            value={answers[question.id] || 0}
            onChange={(v) => setAnswers({ ...answers, [question.id]: v })}
          />
        );
      case 'nps':
        return (
          <NPSRating
            value={answers[question.id] ?? -1}
            onChange={(v) => setAnswers({ ...answers, [question.id]: v })}
            color={primaryColor}
          />
        );
      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {(question.options || []).map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setAnswers({ ...answers, [question.id]: opt })}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                  answers[question.id] === opt
                    ? 'border-2 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={answers[question.id] === opt ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
              >
                <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-medium shrink-0"
                  style={answers[question.id] === opt ? { borderColor: primaryColor, backgroundColor: primaryColor, color: 'white' } : { borderColor: '#d1d5db' }}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="text-sm">{opt}</span>
              </button>
            ))}
          </div>
        );
      case 'text':
        return (
          <Textarea
            placeholder="Escreva sua resposta..."
            value={answers[question.id] || ''}
            onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
            className="border-gray-200 focus:border-gray-400"
            rows={3}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-background">
      <main className="mx-auto w-full max-w-lg px-4 py-6 sm:py-10">
        <div className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* Header */}
          <div className="p-6 sm:p-8 text-center" style={{ backgroundColor: `${primaryColor}10` }}>
            {survey.logo_url && (
              <img
                src={survey.logo_url}
                alt="Logo da pesquisa"
                className="w-28 h-28 sm:w-36 sm:h-36 mx-auto mb-4 rounded-xl object-contain"
              />
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{survey.title}</h1>
            {survey.description && (
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">{survey.description}</p>
            )}
          </div>

          {/* Questions */}
          <div className="p-6 sm:p-8 space-y-6 sm:space-y-8">
            {survey.questions.map((question) => (
              <div key={question.id} className="space-y-3">
                <label className="block text-sm font-medium text-foreground">
                  {question.label}
                  {question.required && <span className="text-destructive ml-1">*</span>}
                </label>
                {renderQuestion(question)}
              </div>
            ))}

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full h-12 text-base font-medium rounded-xl"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Enviar Avaliação
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
