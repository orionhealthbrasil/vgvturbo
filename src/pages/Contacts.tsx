import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Phone, Mail, MessageSquare, Trash2, Tag, Filter, ChevronLeft, ChevronRight, X, Download, Upload, RefreshCw, Loader2, Pencil, TextCursorInput } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NewContactDialog } from '@/components/crm/NewContactDialog';
import { TagManager } from '@/components/crm/TagManager';
import { ContactTagsEditor } from '@/components/crm/ContactTagsEditor';
import { CSVColumnMapper, ColumnMapping } from '@/components/crm/CSVColumnMapper';
import { ImportHistoryPanel } from '@/components/crm/ImportHistoryPanel';
import { EditContactDialog } from '@/components/crm/EditContactDialog';
import { CustomFieldsSettingsCard } from '@/components/organization/CustomFieldsSettingsCard';
import { useDeleteContact, useCreateContact } from '@/hooks/useCRM';
import { useContactsPaginated, useAllContactPhones, ContactFilters } from '@/hooks/useContactsPaginated';
import { useTags, useAddTagToContact } from '@/hooks/useTags';
import { useCreateImportRecord, useUpdateImportRecord } from '@/hooks/useImportHistory';
import { ContactWithColumn } from '@/types/crm';
import { normalizePhone } from '@/lib/phone-link';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { refreshMultipleProfilePictures } from '@/hooks/useProfilePicture';
import { useUserOrganization } from '@/hooks/useOrganization';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { History } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function Contacts() {
  const [isNewContactOpen, setIsNewContactOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [funnelFilter, setFunnelFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [dateFieldFilter, setDateFieldFilter] = useState<'created_at' | 'last_message_at'>('created_at');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApplyingTag, setIsApplyingTag] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<{ name: string; phone: string; email?: string; tags?: string }[]>([]);
  const [isRefreshingPhotos, setIsRefreshingPhotos] = useState(false);
  // Edit contact dialog state
  const [editingContact, setEditingContact] = useState<ContactWithColumn | null>(null);
  const [isCustomFieldsOpen, setIsCustomFieldsOpen] = useState(false);
  // CSV Column Mapper state
  const [isColumnMapperOpen, setIsColumnMapperOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvSampleRows, setCsvSampleRows] = useState<string[][]>([]);
  const [csvAllRows, setCsvAllRows] = useState<string[][]>([]);
  const [autoDetectedMapping, setAutoDetectedMapping] = useState<Partial<ColumnMapping>>({});
  const [photoRefreshProgress, setPhotoRefreshProgress] = useState(0);
  // Export dialog state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'current' | 'custom'>('current');
  const [exportTagId, setExportTagId] = useState<string>('all');
  const [exportDateField, setExportDateField] = useState<'created_at' | 'last_message_at'>('created_at');
  const [exportFrom, setExportFrom] = useState<string>('');
  const [exportTo, setExportTo] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  // Debounce search for server-side filtering
  const debouncedSearch = useDebounce(search, 400);
  
  // Build filters for server-side query
  const filters: ContactFilters = useMemo(() => ({
    search: debouncedSearch || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    funnelStage: funnelFilter !== 'all' ? funnelFilter : undefined,
    tagId: tagFilter !== 'all' ? tagFilter : undefined,
    dateField: dateFieldFilter,
    dateFrom: dateFromFilter || undefined,
    dateTo: dateToFilter || undefined,
  }), [debouncedSearch, statusFilter, funnelFilter, tagFilter, dateFieldFilter, dateFromFilter, dateToFilter]);
  
  // Use server-side paginated hook
  const { data: paginatedData, isLoading, isFetching, refetch: refetchContacts } = useContactsPaginated(
    currentPage,
    itemsPerPage,
    filters
  );
  
  // For duplicate detection during import
  const { data: allPhones = new Set() } = useAllContactPhones();
  
  const contacts = paginatedData?.contacts || [];
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = paginatedData?.totalPages || 0;
  
  const { data: tags = [] } = useTags();
  const { data: orgData } = useUserOrganization();
  const deleteContact = useDeleteContact();
  const createContact = useCreateContact();
  const addTagToContact = useAddTagToContact();
  const createImportRecord = useCreateImportRecord();
  const updateImportRecord = useUpdateImportRecord();

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, funnelFilter, tagFilter, dateFieldFilter, dateFromFilter, dateToFilter]);

  // Selection helpers
  const allPageSelected = contacts.length > 0 && 
    contacts.every(c => selectedContacts.has(c.id));
  const somePageSelected = contacts.some(c => selectedContacts.has(c.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      // Deselect all on current page
      const newSelected = new Set(selectedContacts);
      contacts.forEach(c => newSelected.delete(c.id));
      setSelectedContacts(newSelected);
    } else {
      // Select all on current page
      const newSelected = new Set(selectedContacts);
      contacts.forEach(c => newSelected.add(c.id));
      setSelectedContacts(newSelected);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContacts(newSelected);
  };

  const clearSelection = () => {
    setSelectedContacts(new Set());
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedContacts).map(id => 
        deleteContact.mutateAsync(id)
      );
      await Promise.all(deletePromises);
      toast.success(`${selectedContacts.size} contato(s) excluído(s) com sucesso`);
      clearSelection();
    } catch {
      toast.error('Erro ao excluir alguns contatos');
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleBulkAddTag = async (tagId: string) => {
    setIsApplyingTag(true);
    try {
      const addPromises = Array.from(selectedContacts).map(contactId => 
        addTagToContact.mutateAsync({ contactId, tagId })
      );
      await Promise.allSettled(addPromises);
      toast.success(`Tag aplicada a ${selectedContacts.size} contato(s)`);
      clearSelection();
    } catch {
      toast.error('Erro ao aplicar tag');
    } finally {
      setIsApplyingTag(false);
      setIsTagDialogOpen(false);
    }
  };

  // Filter change handler - no need to reset page manually as useEffect handles it
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
  };

  const hasActiveFilters = statusFilter !== 'all' || funnelFilter !== 'all' || tagFilter !== 'all' || !!dateFromFilter || !!dateToFilter;

  const clearFilters = () => {
    setStatusFilter('all');
    setFunnelFilter('all');
    setTagFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setDateFieldFilter('created_at');
    // Page reset handled by useEffect
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleOpenChat = (contact: ContactWithColumn) => {
    navigate('/chat', { state: { selectedContact: contact } });
  };

  const handleDeleteContact = async (contact: ContactWithColumn) => {
    try {
      await deleteContact.mutateAsync(contact.id);
      toast.success('Contato excluído com sucesso');
    } catch {
      toast.error('Erro ao excluir contato');
    }
  };

  const getFunnelLabel = (stage: string) => {
    switch (stage) {
      case 'lead': return 'Triagem';
      case 'negotiation': return 'Negociação';
      case 'closed': return 'Finalizado';
      default: return stage;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'closed': return 'Fechado';
      case 'snoozed': return 'Agendado';
      default: return status;
    }
  };

  // Export contacts — when nothing is selected, fetch the FULL filtered set
  // from the DB in 1000-row pages (respecting current filters), so the CSV
  // contains every match, not just the current page.
  const [isExporting, setIsExporting] = useState(false);
  const EXPORT_PAGE_SIZE = 1000;
  const EXPORT_HARD_LIMIT = 50000;

  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const getSaleResultLabel = (r?: string | null) => {
    if (r === 'won') return 'Ganho';
    if (r === 'lost') return 'Perda';
    return '';
  };

  const getChannelLabel = (c?: string | null) => {
    if (c === 'whatsapp') return 'WhatsApp';
    if (c === 'instagram') return 'Instagram';
    return c || '';
  };

  // Build CSV with extended fields. `tagsMap` and `assigneesMap` are pre-hydrated.
  const buildCsv = (
    rows: ContactWithColumn[],
    tagsMap: Map<string, string[]> = new Map(),
    assigneesMap: Map<string, string> = new Map(),
  ) => {
    const headers = [
      'Nome', 'Telefone', 'Email', 'Canal', 'Status', 'Etapa',
      'Tags', 'Responsável', 'Valor (R$)', 'Resultado', 'Motivo da Perda',
      'Aniversário', 'Notas', 'Última Mensagem', 'Criado em', 'Atualizado em',
    ];
    const lines = [headers.map(escapeCsv).join(',')];
    for (const c of rows) {
      lines.push([
        c.name,
        c.phone,
        c.email,
        getChannelLabel(c.channel),
        getStatusLabel(c.status),
        getFunnelLabel(c.funnel_stage),
        (tagsMap.get(c.id) || []).join('; '),
        assigneesMap.get(c.assigned_to || '') || '',
        c.deal_value != null ? Number(c.deal_value).toFixed(2).replace('.', ',') : '',
        getSaleResultLabel(c.sale_result),
        c.loss_reason || '',
        c.birth_date ? format(new Date(c.birth_date), 'yyyy-MM-dd') : '',
        c.notes || '',
        c.last_message_at ? format(new Date(c.last_message_at), 'yyyy-MM-dd HH:mm') : '',
        c.created_at ? format(new Date(c.created_at), 'yyyy-MM-dd HH:mm') : '',
        c.updated_at ? format(new Date(c.updated_at), 'yyyy-MM-dd HH:mm') : '',
      ].map(escapeCsv).join(','));
    }
    return lines.join('\n');
  };

  // Hydrate tag names + assignee names for a batch of contacts.
  const hydrateExportRelations = async (
    rows: ContactWithColumn[],
  ): Promise<{ tagsMap: Map<string, string[]>; assigneesMap: Map<string, string> }> => {
    const { supabase } = await import('@/integrations/supabase/client');
    const tagsMap = new Map<string, string[]>();
    const assigneesMap = new Map<string, string>();
    const contactIds = rows.map(r => r.id);
    const assigneeIds = Array.from(new Set(rows.map(r => r.assigned_to).filter(Boolean) as string[]));

    if (contactIds.length > 0) {
      // Chunk to stay under PostgREST URL limits
      const chunkSize = 500;
      for (let i = 0; i < contactIds.length; i += chunkSize) {
        const chunk = contactIds.slice(i, i + chunkSize);
        const { data: ct } = await supabase
          .from('contact_tags')
          .select('contact_id, tags(name)')
          .in('contact_id', chunk);
        for (const row of (ct || []) as any[]) {
          const name = row.tags?.name;
          if (!name) continue;
          const arr = tagsMap.get(row.contact_id) || [];
          arr.push(name);
          tagsMap.set(row.contact_id, arr);
        }
      }
    }

    if (assigneeIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', assigneeIds);
      for (const p of (profs || []) as any[]) {
        assigneesMap.set(p.user_id, p.full_name || p.email || '');
      }
    }

    return { tagsMap, assigneesMap };
  };

  const downloadCsv = (csv: string, count: number) => {
    // BOM for Excel UTF-8 compatibility
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contatos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`${count} contato(s) exportado(s)`);
  };

  type ExportOverrides = {
    ignoreFilters?: boolean;
    tagId?: string | null;
    dateField?: 'created_at' | 'last_message_at';
    dateFrom?: string | null;
    dateTo?: string | null;
  };

  const handleExport = async (overrides?: ExportOverrides) => {
    // Selection-based export keeps the previous, fast behavior
    if (selectedContacts.size > 0 && !overrides) {
      const rows = contacts.filter(c => selectedContacts.has(c.id));
      const { tagsMap, assigneesMap } = await hydrateExportRelations(rows);
      downloadCsv(buildCsv(rows, tagsMap, assigneesMap), rows.length);
      return;
    }

    const organizationId = orgData?.organization.id;
    if (!organizationId) {
      toast.error('Organização não encontrada');
      return;
    }

    const useFilters = !overrides?.ignoreFilters;
    const effectiveTagId = overrides?.tagId !== undefined
      ? overrides.tagId
      : (useFilters && filters.tagId ? filters.tagId : null);
    const dateField = overrides?.dateField ?? 'created_at';
    const dateFrom = overrides?.dateFrom || null;
    const dateTo = overrides?.dateTo || null;

    setIsExporting(true);
    const toastId = toast.loading('Preparando exportação...');
    try {
      const { supabase } = await import('@/integrations/supabase/client');

      const allRows: ContactWithColumn[] = [];
      let from = 0;
      while (from < EXPORT_HARD_LIMIT) {
        let q = supabase
          .from('contacts')
          .select('*')
          .eq('organization_id', organizationId);

        if (useFilters) {
          if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
          if (filters.funnelStage && filters.funnelStage !== 'all') q = q.eq('funnel_stage', filters.funnelStage);
          if (filters.search && filters.search.trim()) {
            const term = `%${filters.search.trim()}%`;
            q = q.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
          }
        }

        if (dateFrom) q = q.gte(dateField, `${dateFrom}T00:00:00`);
        if (dateTo) q = q.lte(dateField, `${dateTo}T23:59:59`);

        const { data, error } = await q
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .range(from, from + EXPORT_PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        let pageRows = data as unknown as ContactWithColumn[];

        // Tag filter is client-side (mirrors useContactsPaginated)
        if (effectiveTagId && effectiveTagId !== 'all') {
          const ids = pageRows.map(c => c.id);
          const { data: ct } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .eq('tag_id', effectiveTagId)
            .in('contact_id', ids);
          const tagged = new Set((ct || []).map(r => r.contact_id));
          pageRows = pageRows.filter(c => tagged.has(c.id));
        }

        allRows.push(...pageRows);
        toast.loading(`Buscando... ${allRows.length} contatos`, { id: toastId });

        if (data.length < EXPORT_PAGE_SIZE) break;
        from += EXPORT_PAGE_SIZE;
      }

      if (allRows.length > EXPORT_HARD_LIMIT) {
        toast.error(`Exportação muito grande (${allRows.length}). Aplique filtros para reduzir abaixo de ${EXPORT_HARD_LIMIT}.`, { id: toastId });
        return;
      }

      toast.loading(`Carregando tags e responsáveis...`, { id: toastId });
      const { tagsMap, assigneesMap } = await hydrateExportRelations(allRows);

      toast.dismiss(toastId);
      downloadCsv(buildCsv(allRows, tagsMap, assigneesMap), allRows.length);
    } catch (err) {
      console.error('[Contacts.handleExport]', err);
      toast.dismiss(toastId);
      toast.error('Erro ao exportar contatos');
    } finally {
      setIsExporting(false);
    }
  };

  const openExportDialog = () => {
    // If selection exists, just export directly (fast path)
    if (selectedContacts.size > 0) {
      handleExport();
      return;
    }
    setExportScope('current');
    setExportTagId('all');
    setExportDateField('created_at');
    setExportFrom('');
    setExportTo('');
    setIsExportDialogOpen(true);
  };

  const confirmExport = async () => {
    setIsExportDialogOpen(false);
    if (exportScope === 'all') {
      await handleExport({ ignoreFilters: true, tagId: null });
    } else if (exportScope === 'custom') {
      await handleExport({
        ignoreFilters: true,
        tagId: exportTagId !== 'all' ? exportTagId : null,
        dateField: exportDateField,
        dateFrom: exportFrom || null,
        dateTo: exportTo || null,
      });
    } else {
      await handleExport();
    }
  };





  // Parse CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Auto-detect column indices
  const autoDetectColumns = (headerLower: string[]): Partial<ColumnMapping> => {
    return {
      firstName: headerLower.findIndex(h => h.includes('first name') || h === 'first_name') !== -1 
        ? headerLower.findIndex(h => h.includes('first name') || h === 'first_name') : null,
      lastName: headerLower.findIndex(h => h.includes('last name') || h === 'last_name') !== -1
        ? headerLower.findIndex(h => h.includes('last name') || h === 'last_name') : null,
      name: headerLower.findIndex(h => h === 'nome' || h === 'name') !== -1
        ? headerLower.findIndex(h => h === 'nome' || h === 'name') : null,
      phone: headerLower.findIndex(h => h.includes('phone') || h.includes('telefone')) !== -1
        ? headerLower.findIndex(h => h.includes('phone') || h.includes('telefone')) : null,
      email: headerLower.findIndex(h => h.includes('email')) !== -1
        ? headerLower.findIndex(h => h.includes('email')) : null,
      tags: headerLower.findIndex(h => h.includes('tags') || h.includes('tag')) !== -1
        ? headerLower.findIndex(h => h.includes('tags') || h.includes('tag')) : null,
    };
  };

  // Process rows with mapping
  const processRowsWithMapping = (rows: string[][], mapping: ColumnMapping) => {
    const parsed: { name: string; phone: string; email?: string; tags?: string }[] = [];

    for (const values of rows) {
      // Build name from first + last or single name column
      let name = '';
      if (mapping.firstName !== null) {
        name = values[mapping.firstName] || '';
        if (mapping.lastName !== null && values[mapping.lastName]) {
          name = `${name} ${values[mapping.lastName]}`.trim();
        }
      } else if (mapping.name !== null) {
        name = values[mapping.name] || '';
      }
      
      // Clean phone number (remove +, spaces, etc)
      const phone = mapping.phone !== null ? normalizePhone(values[mapping.phone] || '') : '';
      
      // Get email if exists
      const email = mapping.email !== null ? values[mapping.email] || undefined : undefined;
      
      // Get tags if exists
      const tagsValue = mapping.tags !== null ? values[mapping.tags] || undefined : undefined;
      
      if (name && phone && phone.length >= 10) {
        parsed.push({ name, phone, email, tags: tagsValue });
      }
    }

    return parsed;
  };

  // Handle file selection for import
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('Arquivo CSV vazio ou inválido');
        return;
      }

      // Parse header and data
      const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, ''));
      const headerLower = headers.map(h => h.toLowerCase());
      const dataRows = lines.slice(1).map(line => parseCSVLine(line));
      
      // Auto-detect mapping
      const detected = autoDetectColumns(headerLower);
      const hasValidAutoDetect = detected.phone !== null && (detected.name !== null || detected.firstName !== null);
      
      // Store CSV data for mapping
      setCsvHeaders(headers);
      setCsvSampleRows(dataRows.slice(0, 5));
      setCsvAllRows(dataRows);
      setAutoDetectedMapping(detected);
      
      if (hasValidAutoDetect) {
        // Auto-detected successfully - process and show import dialog
        const parsed = processRowsWithMapping(dataRows, detected as ColumnMapping);
        if (parsed.length === 0) {
          toast.error('Nenhum contato válido encontrado no arquivo');
          return;
        }
        setImportData(parsed);
        setIsImportDialogOpen(true);
      } else {
        // Could not auto-detect - show column mapper
        setIsColumnMapperOpen(true);
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle column mapping confirmation
  const handleColumnMappingConfirm = (mapping: ColumnMapping) => {
    const parsed = processRowsWithMapping(csvAllRows, mapping);
    
    if (parsed.length === 0) {
      toast.error('Nenhum contato válido encontrado com este mapeamento');
      return;
    }
    
    setImportData(parsed);
    setIsColumnMapperOpen(false);
    setIsImportDialogOpen(true);
  };

  // Perform import with batching for large datasets (runs in background)
  const handleImport = async () => {
    // Capture data before closing dialog
    const dataToImport = [...importData];
    const totalCount = dataToImport.length;
    
    // Close dialog immediately
    setIsImportDialogOpen(false);
    setImportData([]);
    
    // Create import record first
    let importRecordId: string | null = null;
    try {
      const record = await createImportRecord.mutateAsync({
        total_contacts: totalCount,
      });
      importRecordId = record?.id || null;
    } catch (err) {
      console.error('Failed to create import record:', err);
    }
    
    // Show initial toast
    toast.info(`Importando ${totalCount} contato(s) em segundo plano...`);
    
    // Run import in background
    (async () => {
      const BATCH_SIZE = 50;
      let imported = 0;
      let skippedDuplicates = 0;
      let failed = 0;
      let tagsApplied = 0;
      
      try {
        // Use cached phone numbers from useAllContactPhones hook for duplicate detection
        const existingPhones = new Set(allPhones);
        
        // Filter out duplicates from import data
        const newContacts = dataToImport.filter(contact => {
          const normalizedPhone = normalizePhone(contact.phone);
          if (existingPhones.has(normalizedPhone)) {
            skippedDuplicates++;
            return false;
          }
          // Add to set to also detect duplicates within the import file
          existingPhones.add(normalizedPhone);
          return true;
        });
        
        if (newContacts.length === 0) {
          toast.info(`Todos os ${skippedDuplicates} contato(s) já existem no sistema`);
          // Update record as completed with only duplicates
          if (importRecordId) {
            await updateImportRecord.mutateAsync({
              id: importRecordId,
              status: 'completed',
              duplicates_count: skippedDuplicates,
              completed_at: new Date().toISOString(),
            });
          }
          return;
        }
        
        // Create a map of tag names to tag ids for quick lookup
        const tagNameToId = new Map<string, string>();
        tags.forEach(tag => {
          tagNameToId.set(tag.name.toLowerCase().trim(), tag.id);
        });
        
        // Split into batches
        const batches: typeof newContacts[] = [];
        for (let i = 0; i < newContacts.length; i += BATCH_SIZE) {
          batches.push(newContacts.slice(i, i + BATCH_SIZE));
        }
        
        for (const batch of batches) {
          // Process batch in parallel using Promise.allSettled
          const results = await Promise.allSettled(
            batch.map(async (contact) => {
              const createdContact = await createContact.mutateAsync({
                name: contact.name,
                phone: contact.phone,
                email: contact.email || null,
                kanban_column_id: null,
                pipeline_id: null,
                assigned_to: null,
                notes: null,
                funnel_stage: 'lead',
                sale_result: null,
                profile_picture_url: null,
              });
              
              // Apply tags if they exist
              if (contact.tags && createdContact?.id) {
                const tagNames = contact.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                const tagResults = await Promise.allSettled(
                  tagNames.map(async (tagName) => {
                    const tagId = tagNameToId.get(tagName);
                    if (tagId) {
                      await addTagToContact.mutateAsync({ contactId: createdContact.id, tagId });
                      return true;
                    }
                    return false;
                  })
                );
                tagsApplied += tagResults.filter(r => r.status === 'fulfilled' && r.value).length;
              }
              
              return createdContact;
            })
          );
          
          // Count successes and failures
          results.forEach(result => {
            if (result.status === 'fulfilled') {
              imported++;
            } else {
              failed++;
            }
          });
          
          // Small delay between batches to avoid overwhelming the server
          if (batches.indexOf(batch) < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Update import record as completed
        if (importRecordId) {
          await updateImportRecord.mutateAsync({
            id: importRecordId,
            status: 'completed',
            imported_count: imported,
            duplicates_count: skippedDuplicates,
            failed_count: failed,
            tags_applied: tagsApplied,
            completed_at: new Date().toISOString(),
          });
        }
        
        // Build result message
        const messageParts: string[] = [];
        if (imported > 0) messageParts.push(`${imported} importado(s)`);
        if (skippedDuplicates > 0) messageParts.push(`${skippedDuplicates} duplicado(s)`);
        if (failed > 0) messageParts.push(`${failed} erro(s)`);
        if (tagsApplied > 0) messageParts.push(`${tagsApplied} tag(s)`);
        
        toast.success(`✅ Importação concluída: ${messageParts.join(', ')}`);
      } catch (err) {
        // Update import record as failed
        if (importRecordId) {
          await updateImportRecord.mutateAsync({
            id: importRecordId,
            status: 'failed',
            imported_count: imported,
            duplicates_count: skippedDuplicates,
            failed_count: failed,
            tags_applied: tagsApplied,
            completed_at: new Date().toISOString(),
            error_message: err instanceof Error ? err.message : 'Erro desconhecido',
          });
        }
        toast.error('Erro ao importar contatos');
      }
    })();
  };

  // Handle bulk refresh profile pictures
  const handleBulkRefreshPhotos = async () => {
    if (!orgData?.organization.id) {
      toast.error('Organização não encontrada');
      return;
    }
    
    const contactsToRefresh = selectedContacts.size > 0
      ? contacts.filter(c => selectedContacts.has(c.id))
      : contacts;
    
    if (contactsToRefresh.length === 0) {
      toast.error('Nenhum contato para atualizar');
      return;
    }
    
    setIsRefreshingPhotos(true);
    setPhotoRefreshProgress(0);
    
    const contactData = contactsToRefresh.map(c => ({
      id: c.id,
      phone: c.phone,
      organizationId: orgData.organization.id,
    }));
    
    try {
      const result = await refreshMultipleProfilePictures(
        contactData,
        (current, total) => setPhotoRefreshProgress(Math.round((current / total) * 100))
      );
      
      toast.success(`${result.success} foto(s) atualizada(s), ${result.failed} falha(s)`);
      refetchContacts();
    } catch (error) {
      toast.error('Erro ao atualizar fotos de perfil');
    } finally {
      setIsRefreshingPhotos(false);
      setPhotoRefreshProgress(0);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Contatos</h1>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Importar
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">
                <History className="w-4 h-4 mr-2" />
                Histórico
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Histórico de Importações</SheetTitle>
                <SheetDescription>
                  Veja o status e resultados das importações realizadas.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <ImportHistoryPanel />
              </div>
            </SheetContent>
          </Sheet>
          <Button variant="outline" onClick={openExportDialog} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Exportar {selectedContacts.size > 0 ? `(${selectedContacts.size})` : ''}
          </Button>

          <Button variant="outline" onClick={() => setIsTagManagerOpen(true)}>
            <Tag className="w-4 h-4 mr-2" />
            Tags
          </Button>
          <Button variant="outline" onClick={() => setIsCustomFieldsOpen(true)}>
            <TextCursorInput className="w-4 h-4 mr-2" />
            Campos
          </Button>
          <Button onClick={() => setIsNewContactOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedContacts.size > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-primary/10 border-b">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedContacts.size} contato(s) selecionado(s)
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="w-4 h-4 mr-1" />
              Limpar seleção
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Popover open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={isApplyingTag}>
                  <Tag className="w-4 h-4 mr-2" />
                  Atribuir Tag
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="end">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Selecione uma tag</h4>
                  <div className="space-y-1 max-h-[200px] overflow-auto">
                    {tags.map((tag) => (
                      <Button
                        key={tag.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => handleBulkAddTag(tag.id)}
                        disabled={isApplyingTag}
                      >
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: tag.color }} 
                        />
                        {tag.name}
                      </Button>
                    ))}
                    {tags.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2 text-center">
                        Nenhuma tag criada
                      </p>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleBulkRefreshPhotos}
              disabled={isRefreshingPhotos}
            >
              {isRefreshingPhotos ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {photoRefreshProgress}%
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar Fotos
                </>
              )}
            </Button>
            <Button
              variant="destructive" 
              size="sm" 
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </Button>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="p-4 border-b space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filtros
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                    {[statusFilter, funnelFilter, tagFilter].filter(f => f !== 'all').length + (dateFromFilter || dateToFilter ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filtros</h4>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-1 text-xs">
                      <X className="w-3 h-3 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Status</label>
                  <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="closed">Fechado</SelectItem>
                      <SelectItem value="snoozed">Agendado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Etapa do Funil</label>
                  <Select value={funnelFilter} onValueChange={(v) => handleFilterChange(setFunnelFilter, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="lead">Triagem</SelectItem>
                      <SelectItem value="negotiation">Negociação</SelectItem>
                      <SelectItem value="closed">Finalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Tag</label>
                  <Select value={tagFilter} onValueChange={(v) => handleFilterChange(setTagFilter, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {tags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: tag.color }} 
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <label className="text-sm text-muted-foreground">Período</label>
                  <Select value={dateFieldFilter} onValueChange={(v) => setDateFieldFilter(v as 'created_at' | 'last_message_at')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Data de criação</SelectItem>
                      <SelectItem value="last_message_at">Última mensagem</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">De</label>
                      <Input
                        type="date"
                        value={dateFromFilter}
                        onChange={(e) => setDateFromFilter(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Até</label>
                      <Input
                        type="date"
                        value={dateToFilter}
                        onChange={(e) => setDateToFilter(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Select 
            value={String(itemsPerPage)} 
            onValueChange={(v) => {
              setItemsPerPage(Number(v));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} por página
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Filtros ativos:</span>
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Status: {getStatusLabel(statusFilter)}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => handleFilterChange(setStatusFilter, 'all')} 
                />
              </Badge>
            )}
            {funnelFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Funil: {getFunnelLabel(funnelFilter)}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => handleFilterChange(setFunnelFilter, 'all')} 
                />
              </Badge>
            )}
            {tagFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Tag: {tags.find(t => t.id === tagFilter)?.name || tagFilter}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => handleFilterChange(setTagFilter, 'all')} 
                />
              </Badge>
            )}
            {(dateFromFilter || dateToFilter) && (
              <Badge variant="secondary" className="gap-1">
                {dateFieldFilter === 'created_at' ? 'Criação' : 'Última msg'}: {dateFromFilter || '...'} → {dateToFilter || '...'}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => { setDateFromFilter(''); setDateToFilter(''); }}
                />
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Nenhum contato encontrado</p>
            <p className="text-sm mt-2">
              {hasActiveFilters || search
                ? 'Tente ajustar os filtros ou a busca.'
                : 'Clique em "Novo Contato" para adicionar um contato.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Selecionar todos"
                    className={somePageSelected && !allPageSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                  />
                </TableHead>
                <TableHead className="w-[280px]">Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Última Mensagem</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow 
                  key={contact.id} 
                  className={selectedContacts.has(contact.id) ? 'bg-primary/5' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedContacts.has(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                      aria-label={`Selecionar ${contact.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        {contact.profile_picture_url && (
                          <AvatarImage 
                            src={contact.profile_picture_url} 
                            alt={contact.name}
                            className="object-cover"
                          />
                        )}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {getInitials(contact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{contact.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      {contact.phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.email ? (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">{contact.email}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.status === 'open' ? 'default' : 'secondary'}>
                      {getStatusLabel(contact.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline"
                      className={
                        contact.funnel_stage === 'negotiation' 
                          ? 'border-orange-500 text-orange-600' 
                          : ''
                      }
                    >
                      {contact.funnel_stage === 'negotiation' && '💰 '}
                      {getFunnelLabel(contact.funnel_stage)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ContactTagsEditor contactId={contact.id} showLabel={false} compact />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {contact.last_message_at
                      ? formatDistanceToNow(new Date(contact.last_message_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingContact(contact)}
                        title="Editar contato"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenChat(contact)}
                        title="Abrir Chat"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteContact(contact)}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalCount)} de {totalCount} contatos
            {isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    className="w-9"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <NewContactDialog
        open={isNewContactOpen}
        onOpenChange={setIsNewContactOpen}
      />

      <TagManager
        open={isTagManagerOpen}
        onOpenChange={setIsTagManagerOpen}
      />

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar contatos</DialogTitle>
            <DialogDescription>
              Escolha quais contatos deseja exportar para CSV.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Escopo</label>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded-md border hover:bg-accent">
                  <input
                    type="radio"
                    name="export-scope"
                    className="mt-1"
                    checked={exportScope === 'current'}
                    onChange={() => setExportScope('current')}
                  />
                  <div>
                    <p className="text-sm font-medium">Filtros atuais</p>
                    <p className="text-xs text-muted-foreground">
                      Usa os filtros aplicados na tela ({totalCount} contato(s))
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded-md border hover:bg-accent">
                  <input
                    type="radio"
                    name="export-scope"
                    className="mt-1"
                    checked={exportScope === 'all'}
                    onChange={() => setExportScope('all')}
                  />
                  <div>
                    <p className="text-sm font-medium">Todos os contatos</p>
                    <p className="text-xs text-muted-foreground">
                      Ignora filtros da tela
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded-md border hover:bg-accent">
                  <input
                    type="radio"
                    name="export-scope"
                    className="mt-1"
                    checked={exportScope === 'custom'}
                    onChange={() => setExportScope('custom')}
                  />
                  <div>
                    <p className="text-sm font-medium">Personalizado</p>
                    <p className="text-xs text-muted-foreground">
                      Filtrar por período e/ou tag
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {exportScope === 'custom' && (
              <div className="space-y-3 border-t pt-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tag</label>
                  <Select value={exportTagId} onValueChange={setExportTagId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as tags</SelectItem>
                      {tags.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Campo de data</label>
                  <Select value={exportDateField} onValueChange={(v) => setExportDateField(v as 'created_at' | 'last_message_at')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Data de criação</SelectItem>
                      <SelectItem value="last_message_at">Última mensagem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">De</label>
                    <Input
                      type="date"
                      value={exportFrom}
                      onChange={(e) => setExportFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Até</label>
                    <Input
                      type="date"
                      value={exportTo}
                      onChange={(e) => setExportTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Exportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedContacts.size} contato(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os contatos selecionados e suas mensagens serão permanentemente excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Confirmation Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar Contatos</DialogTitle>
            <DialogDescription>
              {importData.length} contato(s) encontrado(s) no arquivo CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importData.slice(0, 10).map((contact, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.email || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.tags || '-'}</TableCell>
                  </TableRow>
                ))}
                {importData.length > 10 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      ... e mais {importData.length - 10} contato(s)
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              💡 Tags serão importadas se já existirem no sistema.
            </p>
            <Button
              variant="link"
              size="sm"
              className="text-xs p-0 h-auto"
              onClick={() => {
                setIsImportDialogOpen(false);
                setIsColumnMapperOpen(true);
              }}
            >
              Remapear colunas
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport}>
              Importar {importData.length} contato(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Column Mapper Dialog */}
      <CSVColumnMapper
        open={isColumnMapperOpen}
        onOpenChange={setIsColumnMapperOpen}
        headers={csvHeaders}
        sampleRows={csvSampleRows}
        onConfirm={handleColumnMappingConfirm}
        autoDetectedMapping={autoDetectedMapping}
      />

      {/* Edit Contact Dialog */}
      {editingContact && (
        <EditContactDialog
          open={!!editingContact}
          onOpenChange={(open) => !open && setEditingContact(null)}
          contact={editingContact}
          onManageCustomFields={() => setIsCustomFieldsOpen(true)}
        />
      )}

      {/* Custom Fields Manager Sheet */}
      <Sheet open={isCustomFieldsOpen} onOpenChange={setIsCustomFieldsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>Campos Personalizados</SheetTitle>
            <SheetDescription>
              Crie e gerencie campos extras para armazenar informações dos seus contatos.
            </SheetDescription>
          </SheetHeader>
          <CustomFieldsSettingsCard />
        </SheetContent>
      </Sheet>
    </div>
  );
}
