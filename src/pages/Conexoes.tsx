import { useSearchParams } from 'react-router-dom';
import { Smartphone, Instagram, Mail, Plug, Key, ShieldCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useOrganization';
import { useEmailSettings } from '@/hooks/useEmailSettings';
import WhatsAppConnection from './WhatsAppConnection';
import InstagramConnection from './InstagramConnection';
import EmailSettings from './EmailSettings';
import MetaConnection from './MetaConnection';
import { ApiKeysSettingsCard } from '@/components/organization/ApiKeysSettingsCard';

type TabKey = 'whatsapp' | 'meta' | 'email' | 'api'; // INSTAGRAM_HIDDEN: | 'instagram'
const VALID_TABS: TabKey[] = ['whatsapp', 'meta', 'email', 'api']; // INSTAGRAM_HIDDEN: 'instagram'

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        connected ? 'bg-status-success' : 'bg-muted-foreground/40'
      }`}
      aria-label={connected ? 'Conectado' : 'Desconectado'}
    />
  );
}

export default function Conexoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'whatsapp';

  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization?.id;

  // WhatsApp connected status (presence of instance is "configured" — good enough as visual hint)
  const { data: whatsappConnected } = useQuery({
    queryKey: ['conexoes-status-whatsapp', orgId],
    queryFn: async () => {
      if (!orgId) return false;
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('organization_id', orgId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!orgId,
  });

  const { data: instagramConnected } = useQuery({
    queryKey: ['conexoes-status-instagram', orgId],
    queryFn: async () => {
      if (!orgId) return false;
      const { data } = await supabase
        .from('instagram_instances')
        .select('id')
        .eq('organization_id', orgId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!orgId,
  });

  const { data: emailSettings } = useEmailSettings();
  const emailConnected = !!emailSettings?.resend_api_key;

  const { data: metaConnected } = useQuery({
    queryKey: ['conexoes-status-meta', orgId],
    queryFn: async () => {
      if (!orgId) return false;
      const { data } = await supabase
        .from('whatsapp_meta_instances' as any)
        .select('id')
        .eq('organization_id', orgId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!orgId,
  });

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Plug className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Conexões</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as integrações da sua empresa em um só lugar.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-4xl"> {/* INSTAGRAM_HIDDEN: grid-cols-5 */}
          <TabsTrigger value="whatsapp" className="gap-2">
            <Smartphone className="w-4 h-4" />
            <span>WhatsApp</span>
            <StatusDot connected={!!whatsappConnected} />
          </TabsTrigger>
          <TabsTrigger value="meta" className="gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>API Oficial</span>
            <StatusDot connected={!!metaConnected} />
          </TabsTrigger>
          {/* INSTAGRAM_HIDDEN:
          <TabsTrigger value="instagram" className="gap-2">
            <Instagram className="w-4 h-4" />
            <span>Instagram</span>
            <StatusDot connected={!!instagramConnected} />
          </TabsTrigger>
          */}
          <TabsTrigger value="email" className="gap-2">
            <Mail className="w-4 h-4" />
            <span>Email</span>
            <StatusDot connected={emailConnected} />
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Key className="w-4 h-4" />
            <span>API / MCP</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-0">
          <WhatsAppConnection />
        </TabsContent>
        <TabsContent value="meta" className="mt-0">
          <MetaConnection />
        </TabsContent>
        {/* INSTAGRAM_HIDDEN:
        <TabsContent value="instagram" className="mt-0">
          <InstagramConnection />
        </TabsContent>
        */}
        <TabsContent value="email" className="mt-0">
          <EmailSettings />
        </TabsContent>
        <TabsContent value="api" className="mt-0">
          {orgId && <ApiKeysSettingsCard organizationId={orgId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
