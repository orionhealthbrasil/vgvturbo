import { useState, useRef, useEffect } from 'react';
import { 
  Users, 
  Tag, 
  FileSpreadsheet, 
  Play, 
  Pause, 
  X, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Search,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  BroadcastCampaign, 
  useBroadcastRecipients, 
  useAddBroadcastRecipients,
  useClearBroadcastRecipients 
} from '@/hooks/useBroadcast';
import { useContacts } from '@/hooks/useCRM';
import { useTags } from '@/hooks/useTags';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CampaignPerformanceReport } from './CampaignPerformanceReport';

interface CampaignDetailDialogProps {
  campaign: BroadcastCampaign | null;
  onClose: () => void;
  onStart: (campaign: BroadcastCampaign) => void;
  onPause: (campaignId: string) => void;
  onCancel: (campaignId: string) => void;
}

const STATUS_LABELS: Record<BroadcastCampaign['status'], string> = {
  draft: 'Rascunho',
  scheduled: 'Agendado',
  running: 'Em execução',
  paused: 'Pausado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<BroadcastCampaign['status'], string> = {
  draft: 'bg-gray-500',
  scheduled: 'bg-blue-500',
  running: 'bg-green-500',
  paused: 'bg-yellow-500',
  completed: 'bg-emerald-600',
  cancelled: 'bg-red-500',
};

export function CampaignDetailDialog({ 
  campaign, 
  onClose, 
  onStart, 
  onPause, 
  onCancel 
}: CampaignDetailDialogProps) {
  const queryClient = useQueryClient();
  const { data: recipients, isLoading: loadingRecipients, refetch: refetchRecipients } = useBroadcastRecipients(campaign?.id || null);
  const { data: contacts } = useContacts();
  const { data: tags } = useTags();
  const addRecipients = useAddBroadcastRecipients();
  const clearRecipients = useClearBroadcastRecipients();

  const [activeTab, setActiveTab] = useState('recipients');
  const [addMode, setAddMode] = useState<'manual' | 'tag' | 'csv' | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [clearConfirm, setClearConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-refresh recipients when campaign is running
  useEffect(() => {
    if (campaign?.status === 'running') {
      const interval = setInterval(() => {
        refetchRecipients();
        queryClient.invalidateQueries({ queryKey: ['broadcast-campaigns'] });
      }, 10000); // Every 10 seconds
      return () => clearInterval(interval);
    }
  }, [campaign?.status, refetchRecipients, queryClient]);

  if (!campaign) return null;

  const canEdit = campaign.status === 'draft' || campaign.status === 'paused';

  // Filter contacts for manual selection
  const existingPhones = new Set(recipients?.map(r => r.phone.replace(/\D/g, '')) || []);
  const availableContacts = contacts?.filter(c => {
    const phone = c.phone.replace(/\D/g, '');
    return !existingPhones.has(phone) && c.name.toLowerCase().includes(searchQuery.toLowerCase());
  }) || [];

  const handleAddManual = () => {
    if (selectedContacts.size === 0) return;

    const contactsToAdd = contacts
      ?.filter(c => selectedContacts.has(c.id))
      .map(c => ({
        phone: c.phone,
        name: c.name,
        contact_id: c.id,
      })) || [];

    addRecipients.mutate({ 
      campaignId: campaign.id, 
      recipients: contactsToAdd 
    });
    setSelectedContacts(new Set());
    setAddMode(null);
  };

  const handleAddByTag = () => {
    if (!selectedTag) return;

    const tagContacts = contacts?.filter(c => 
      c.tags?.some(t => t.id === selectedTag)
    ) || [];

    const newRecipients = tagContacts
      .filter(c => !existingPhones.has(c.phone.replace(/\D/g, '')))
      .map(c => ({
        phone: c.phone,
        name: c.name,
        contact_id: c.id,
      }));

    if (newRecipients.length === 0) {
      toast.info('Nenhum contato novo encontrado com essa tag');
      return;
    }

    addRecipients.mutate({ 
      campaignId: campaign.id, 
      recipients: newRecipients 
    });
    setSelectedTag('');
    setAddMode(null);
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      
      if (lines.length < 2) {
        toast.error('Arquivo vazio ou sem dados');
        return;
      }

      // Parse CSV - expect columns: phone, name (optional)
      const header = lines[0].toLowerCase();
      const phoneColIndex = header.includes('telefone') ? 
        header.split(/[,;]/).findIndex(h => h.includes('telefone')) :
        header.split(/[,;]/).findIndex(h => h.includes('phone'));
      const nameColIndex = header.split(/[,;]/).findIndex(h => 
        h.includes('nome') || h.includes('name')
      );

      if (phoneColIndex === -1) {
        toast.error('Coluna de telefone não encontrada');
        return;
      }

      const newRecipients: { phone: string; name?: string }[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[,;]/);
        const phone = cols[phoneColIndex]?.replace(/\D/g, '').trim();
        const name = nameColIndex >= 0 ? cols[nameColIndex]?.trim() : undefined;

        if (phone && phone.length >= 10 && !existingPhones.has(phone)) {
          newRecipients.push({ phone, name });
          existingPhones.add(phone);
        }
      }

      if (newRecipients.length === 0) {
        toast.info('Nenhum contato novo encontrado no CSV');
        return;
      }

      addRecipients.mutate({ 
        campaignId: campaign.id, 
        recipients: newRecipients 
      });
      setAddMode(null);
    } catch (error) {
      toast.error('Erro ao processar CSV');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleContactSelection = (contactId: string) => {
    const newSet = new Set(selectedContacts);
    if (newSet.has(contactId)) {
      newSet.delete(contactId);
    } else {
      newSet.add(contactId);
    }
    setSelectedContacts(newSet);
  };

  const handleClear = () => {
    clearRecipients.mutate(campaign.id);
    setClearConfirm(false);
  };

  const progress = campaign.total_contacts > 0 
    ? Math.round((campaign.sent_count / campaign.total_contacts) * 100) 
    : 0;

  return (
    <Dialog open={!!campaign} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {campaign.name}
              <Badge className={STATUS_COLORS[campaign.status]}>
                {STATUS_LABELS[campaign.status]}
              </Badge>
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        {campaign.status === 'running' && (
          <div className="px-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{progress}% concluído</span>
              <span>{campaign.sent_count}/{campaign.total_contacts}</span>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 px-1">
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <Users className="w-4 h-4 mx-auto text-muted-foreground" />
            <p className="text-lg font-semibold">{campaign.total_contacts}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <Clock className="w-4 h-4 mx-auto text-yellow-500" />
            <p className="text-lg font-semibold">{campaign.total_contacts - campaign.sent_count - campaign.failed_count}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <CheckCircle className="w-4 h-4 mx-auto text-green-500" />
            <p className="text-lg font-semibold">{campaign.sent_count}</p>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <AlertCircle className="w-4 h-4 mx-auto text-red-500" />
            <p className="text-lg font-semibold">{campaign.failed_count}</p>
            <p className="text-xs text-muted-foreground">Falhas</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="mx-1">
            <TabsTrigger value="recipients">Destinatários</TabsTrigger>
            <TabsTrigger value="report" className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              Relatório
            </TabsTrigger>
            <TabsTrigger value="message">Mensagem</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="recipients" className="flex-1 overflow-hidden flex flex-col">
            {/* Add Recipients Actions */}
            {canEdit && !addMode && (
              <div className="flex gap-2 mb-4 px-1">
                <Button variant="outline" size="sm" onClick={() => setAddMode('manual')}>
                  <Users className="w-4 h-4 mr-1" />
                  Selecionar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAddMode('tag')}>
                  <Tag className="w-4 h-4 mr-1" />
                  Por Tag
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAddMode('csv')}>
                  <FileSpreadsheet className="w-4 h-4 mr-1" />
                  Importar CSV
                </Button>
                {recipients && recipients.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="ml-auto text-destructive hover:text-destructive"
                    onClick={() => setClearConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            )}

            {/* Add Mode: Manual */}
            {addMode === 'manual' && (
              <div className="space-y-2 mb-4 px-1">
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar contatos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={() => setAddMode(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddManual} disabled={selectedContacts.size === 0}>
                    Adicionar ({selectedContacts.size})
                  </Button>
                </div>
                <ScrollArea className="h-48 border rounded-lg">
                  {availableContacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                      Nenhum contato encontrado
                    </p>
                  ) : (
                    <div className="p-2 space-y-1">
                      {availableContacts.slice(0, 50).map(contact => (
                        <label
                          key={contact.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedContacts.has(contact.id)}
                            onCheckedChange={() => toggleContactSelection(contact.id)}
                          />
                          <span className="text-sm">{contact.name}</span>
                          <span className="text-xs text-muted-foreground">{contact.phone}</span>
                        </label>
                      ))}
                      {availableContacts.length > 50 && (
                        <p className="text-xs text-muted-foreground text-center p-2">
                          Mostrando 50 de {availableContacts.length} contatos
                        </p>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}

            {/* Add Mode: Tag */}
            {addMode === 'tag' && (
              <div className="flex gap-2 mb-4 px-1">
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {tags?.map(tag => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <span className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: tag.color }} 
                          />
                          {tag.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={() => setAddMode(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddByTag} disabled={!selectedTag}>
                  Adicionar
                </Button>
              </div>
            )}

            {/* Add Mode: CSV */}
            {addMode === 'csv' && (
              <div className="flex gap-2 mb-4 px-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCSVUpload}
                  className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                <Button variant="outline" onClick={() => setAddMode(null)}>
                  Cancelar
                </Button>
              </div>
            )}

            {/* Recipients List */}
            <ScrollArea className="flex-1 border rounded-lg mx-1">
              {loadingRecipients ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  Carregando...
                </p>
              ) : !recipients || recipients.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  Nenhum destinatário adicionado
                </p>
              ) : (
                <div className="p-2 space-y-1">
                  {recipients.map((recipient, idx) => (
                    <div 
                      key={recipient.id}
                      className="flex items-center justify-between p-2 hover:bg-muted rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6">
                          {idx + 1}
                        </span>
                        <span>{recipient.name || 'Sem nome'}</span>
                        <span className="text-xs text-muted-foreground">
                          {recipient.phone}
                        </span>
                      </div>
                      <Badge 
                        variant={
                          recipient.status === 'sent' ? 'default' :
                          recipient.status === 'failed' ? 'destructive' :
                          'secondary'
                        }
                        className="text-xs"
                      >
                        {recipient.status === 'pending' && 'Pendente'}
                        {recipient.status === 'sent' && 'Enviado'}
                        {recipient.status === 'failed' && 'Falhou'}
                        {recipient.status === 'skipped' && 'Pulado'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="report" className="flex-1 overflow-auto">
            <CampaignPerformanceReport campaign={campaign} recipients={recipients} />
          </TabsContent>

          <TabsContent value="message" className="flex-1 px-1">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Mensagem</h4>
                <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                  {campaign.message_content}
                </div>
              </div>
              {campaign.media_url && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Imagem</h4>
                  <img 
                    src={campaign.media_url} 
                    alt="Campaign media" 
                    className="max-w-48 rounded-lg"
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 px-1">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Intervalo entre mensagens</p>
                  <p className="font-medium">
                    {Math.round(campaign.min_interval_seconds / 60)} - {Math.round(campaign.max_interval_seconds / 60)} minutos
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Tamanho do lote</p>
                  <p className="font-medium">{campaign.batch_size} mensagens</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Pausa entre lotes</p>
                  <p className="font-medium">
                    {Math.round(campaign.batch_pause_min_seconds / 60)} - {Math.round(campaign.batch_pause_max_seconds / 60)} minutos
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Limite por hora</p>
                  <p className="font-medium">{campaign.messages_per_hour_limit} msgs/hora</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          
          {campaign.status === 'running' && (
            <>
              <Button 
                variant="outline" 
                onClick={() => refetchRecipients()}
                size="icon"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="secondary" onClick={() => onPause(campaign.id)}>
                <Pause className="w-4 h-4 mr-2" />
                Pausar
              </Button>
              <Button variant="destructive" onClick={() => onCancel(campaign.id)}>
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </>
          )}

          {(campaign.status === 'draft' || campaign.status === 'paused') && (
            <Button 
              onClick={() => onStart(campaign)}
              disabled={campaign.total_contacts === 0}
              className="ml-auto"
            >
              <Play className="w-4 h-4 mr-2" />
              {campaign.status === 'paused' ? 'Continuar' : 'Iniciar Disparo'}
            </Button>
          )}
        </div>
      </DialogContent>

      {/* Clear Confirmation */}
      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os destinatários?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá todos os contatos da campanha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground">
              Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
