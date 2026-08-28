import { useUserOrganization } from '@/hooks/useOrganization';
import { SatisfactionAnalytics } from '@/components/analytics/SatisfactionAnalytics';
import { ResponseTimeAnalytics } from '@/components/analytics/ResponseTimeAnalytics';
import { LossAnalytics } from '@/components/analytics/LossAnalytics';
import { SalesAnalytics } from '@/components/analytics/SalesAnalytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Analytics() {
  const { data: orgData } = useUserOrganization();
  
  const isViewer = orgData?.membership?.member_role === 'viewer';
  const isAnalystOrHigher = orgData?.membership?.role === 'owner' || 
    orgData?.membership?.member_role === 'admin' || 
    orgData?.membership?.member_role === 'analyst';

  const pageTitle = isViewer ? 'Minhas Análises' : 'Análises';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
        <p className="text-muted-foreground">Métricas e registros</p>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList>
          <TabsTrigger value="sales">Análise das Vendas</TabsTrigger>
          <TabsTrigger value="response-time">Tempo de Atendimento</TabsTrigger>
          <TabsTrigger value="satisfaction">Satisfação</TabsTrigger>
          <TabsTrigger value="losses">Análises das Perdas</TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
          <SalesAnalytics />
        </TabsContent>
        <TabsContent value="response-time">
          <ResponseTimeAnalytics />
        </TabsContent>
        <TabsContent value="satisfaction">
          <SatisfactionAnalytics
            isViewer={!!isViewer}
            isAnalystOrHigher={!!isAnalystOrHigher}
          />
        </TabsContent>
        <TabsContent value="losses">
          <LossAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}

