import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Loader2, Clock, User, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useImportHistory } from '@/hooks/useImportHistory';

export function ImportHistoryPanel() {
  const { data: history = [], isLoading } = useImportHistory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileSpreadsheet className="w-10 h-10 mb-3 opacity-50" />
        <p className="text-sm">Nenhuma importação realizada</p>
        <p className="text-xs">O histórico aparecerá aqui após importar contatos</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-4">
        {history.map((record, idx) => (
          <div key={record.id}>
            <div className="flex items-start gap-3 py-2">
              {/* Status Icon */}
              <div className="mt-0.5">
                {record.status === 'in_progress' && (
                  <div className="relative">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
                  </div>
                )}
                {record.status === 'completed' && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {record.status === 'failed' && (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {record.status === 'in_progress' ? 'Importando...' : 'Importação'}
                    </span>
                    {record.status === 'in_progress' && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 animate-pulse">
                        Em andamento
                      </Badge>
                    )}
                    {record.status === 'completed' && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Concluída
                      </Badge>
                    )}
                    {record.status === 'failed' && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Falhou
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(record.started_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {record.status === 'in_progress' ? (
                    <span>
                      Processando {record.total_contacts} contato(s)...
                    </span>
                  ) : (
                    <>
                      {record.imported_count > 0 && (
                        <span className="text-green-600">✓ {record.imported_count} importado(s)</span>
                      )}
                      {record.duplicates_count > 0 && (
                        <span className="text-yellow-600">⊘ {record.duplicates_count} duplicado(s)</span>
                      )}
                      {record.failed_count > 0 && (
                        <span className="text-destructive">✕ {record.failed_count} erro(s)</span>
                      )}
                      {record.tags_applied > 0 && (
                        <span className="text-blue-600">🏷 {record.tags_applied} tag(s)</span>
                      )}
                    </>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {record.importer_name}
                  </span>
                  {record.file_name && (
                    <span className="flex items-center gap-1 truncate max-w-[150px]">
                      <FileSpreadsheet className="w-3 h-3" />
                      {record.file_name}
                    </span>
                  )}
                </div>

                {record.error_message && (
                  <p className="text-xs text-destructive mt-1">{record.error_message}</p>
                )}
              </div>
            </div>
            {idx < history.length - 1 && <Separator />}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
