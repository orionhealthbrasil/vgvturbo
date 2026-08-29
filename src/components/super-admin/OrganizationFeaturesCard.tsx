import { Wallet, Loader2, Mic, ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useOrganizationFeatures, useToggleFeature } from '@/hooks/useOrganizationFeatures';

interface Props {
  organizationId: string;
}

const FEATURES = [
  {
    key: 'financial' as const,
    icon: Wallet,
    title: 'Financeiro',
    description: 'Lançamentos, recorrências, contas, categorias e relatórios financeiros.',
    defaultEnabled: false,
  },
  {
    key: 'ai_transcription' as const,
    icon: Mic,
    title: 'Transcrição de áudio (IA)',
    description: 'Transcreve áudios recebidos no WhatsApp via Whisper. Consome VGVCash a cada uso.',
    defaultEnabled: true,
  },
  {
    key: 'ai_image_description' as const,
    icon: ImageIcon,
    title: 'Descrição de imagens/vídeos (IA)',
    description: 'Descreve o conteúdo de fotos e vídeos recebidos no WhatsApp. Consome VGVCash a cada uso.',
    defaultEnabled: true,
  },
];

export function OrganizationFeaturesCard({ organizationId }: Props) {
  const { data: features = [], isLoading } = useOrganizationFeatures(organizationId);
  const toggle = useToggleFeature();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Módulos opcionais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          FEATURES.map((f) => {
            const enabled = features.find((x) => x.feature_key === f.key)?.is_enabled ?? f.defaultEnabled;
            const Icon = f.icon;
            return (
              <div key={f.key} className="flex items-center justify-between p-3 border rounded-lg gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <Label className="font-medium">{f.title}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  disabled={toggle.isPending}
                  onCheckedChange={(checked) =>
                    toggle.mutate({ orgId: organizationId, feature: f.key, enabled: checked })
                  }
                />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
