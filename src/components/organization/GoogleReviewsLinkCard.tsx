import { useEffect, useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface GoogleReviewsLinkCardProps {
  organizationId: string;
  googleReviewsUrl: string | null;
  isOwner: boolean;
}

export function GoogleReviewsLinkCard({ organizationId, googleReviewsUrl, isOwner }: GoogleReviewsLinkCardProps) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(googleReviewsUrl ?? '');

  useEffect(() => {
    setUrl(googleReviewsUrl ?? '');
  }, [googleReviewsUrl]);

  const save = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from('organizations')
        .update({ google_reviews_url: value.trim() || null } as any)
        .eq('id', organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-organization'] });
      toast.success('Link salvo!');
    },
    onError: () => toast.error('Erro ao salvar link'),
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5" />
          Link de avaliações do Google
        </CardTitle>
        <CardDescription>
          Opcional. Cole aqui o link público da sua página de avaliações no Google para usar em mensagens de pós-atendimento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>URL</Label>
          <Input
            type="url"
            placeholder="https://g.page/r/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={!isOwner}
          />
        </div>
        {isOwner && (
          <Button onClick={() => save.mutate(url)} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
