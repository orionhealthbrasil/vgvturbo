import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Database, MessageSquare, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ORG_ID = '7483e12d-827c-4e6f-ac12-43d6fe67b0f8';

interface ContactRow {
  id: string;
  name: string;
  phone: string;
  last_message_at: string;
  unread_count: string;
  status: string;
}

function parseCSV(text: string, separator: string): ContactRow[] {
  const lines = text.trim().split('\n');
  const header = lines[0].split(separator);
  const phoneIdx = header.indexOf('phone');
  const nameIdx = header.indexOf('name');
  const idIdx = header.indexOf('id');
  const lastMsgIdx = header.indexOf('last_message_at');
  const unreadIdx = header.indexOf('unread_count');
  const statusIdx = header.indexOf('status');

  return lines.slice(1).map(line => {
    const cols = line.split(separator);
    return {
      id: cols[idIdx] || '',
      name: cols[nameIdx] || '',
      phone: cols[phoneIdx] || '',
      last_message_at: cols[lastMsgIdx] || '',
      unread_count: cols[unreadIdx] || '0',
      status: cols[statusIdx] || '',
    };
  }).filter(r => r.phone);
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function parseFullRows(text: string, separator: string): { header: string[]; rows: Map<string, string[]> } {
  const lines = text.trim().split('\n');
  const headerCols = lines[0].split(separator);
  const phoneIdx = headerCols.indexOf('phone');
  const rows = new Map<string, string[]>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator);
    const phone = cols[phoneIdx];
    if (phone) rows.set(phone, cols);
  }
  return { header: headerCols, rows };
}

const sqlEscapeGlobal = (s: string) => s.replace(/'/g, "''");

export default function ContactDiff() {
  const [onlyInDB1, setOnlyInDB1] = useState<ContactRow[]>([]);
  const [onlyInDB2, setOnlyInDB2] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [db1Count, setDb1Count] = useState(0);
  const [db2Count, setDb2Count] = useState(0);
  const [csvDownloadUrl, setCsvDownloadUrl] = useState<string | null>(null);
  const [sqlDownloadUrl, setSqlDownloadUrl] = useState<string | null>(null);
  const [sqlContent, setSqlContent] = useState<string>('');
  const [showSql, setShowSql] = useState(false);
  const [cloudOnlyContacts, setCloudOnlyContacts] = useState<ContactRow[]>([]);
  const [msgSql, setMsgSql] = useState<string>('');
  const [showMsgSql, setShowMsgSql] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [msgCount, setMsgCount] = useState(0);

  useEffect(() => {
    async function load() {
      const [res1, res2] = await Promise.all([
        fetch('/data/contacts_db1.csv').then(r => r.text()),
        fetch('/data/contacts_db2.csv').then(r => r.text()),
      ]);

      const db1 = parseCSV(res1, ',');
      const db2 = parseCSV(res2, ';');

      setDb1Count(db1.length);
      setDb2Count(db2.length);

      const normalizePhone = (p: string) => p.replace(/\D/g, '').trim();
      const phones1 = new Set(db1.map(c => normalizePhone(c.phone)));
      const phones2 = new Set(db2.map(c => normalizePhone(c.phone)));

      setOnlyInDB1(db1.filter(c => !phones2.has(normalizePhone(c.phone))));
      const cloudOnly = db2.filter(c => !phones1.has(normalizePhone(c.phone)));
      setOnlyInDB2(cloudOnly);
      setCloudOnlyContacts(cloudOnly);

      // Build full CSV for Cloud-only contacts (without id column to avoid conflicts)
      const full2 = parseFullRows(res2, ';');
      const missingPhones = cloudOnly.map(c => c.phone);
      
      // Remove 'id' column to let the DB generate new UUIDs
      const idIdx = full2.header.indexOf('id');
      const headerWithoutId = full2.header.filter((_, i) => i !== idIdx);
      const csvHeader = headerWithoutId.map(escapeCSVField).join(',');
      const csvRows = missingPhones
        .map(phone => full2.rows.get(phone))
        .filter((row): row is string[] => !!row)
        .map(cols => cols.filter((_, i) => i !== idIdx).map(escapeCSVField).join(','));
      
      const csvContent = [csvHeader, ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      setCsvDownloadUrl(URL.createObjectURL(blob));

      // Build SQL with ON CONFLICT DO NOTHING
      const jsonColumns = new Set(['flow_context']);
      const boolColumns = new Set(['waiting_response', 'sla_alert_sent', 'automations_paused']);
      const intColumns = new Set(['unread_count']);
      
      const sqlStatements = missingPhones
        .map(phone => full2.rows.get(phone))
        .filter((row): row is string[] => !!row)
        .map(cols => {
          const filteredHeader = headerWithoutId;
          const filteredCols = cols.filter((_, i) => i !== idIdx);
          const colNames = filteredHeader.join(', ');
          const colValues = filteredCols.map((v, ci) => {
            const colName = filteredHeader[ci];
            if (v === '' || v === null || v === undefined) return 'NULL';
            if (boolColumns.has(colName)) return v.toLowerCase() === 'true' ? 'true' : 'false';
            if (intColumns.has(colName)) return v;
            if (jsonColumns.has(colName)) {
              let json = v;
              if (json.startsWith('"') && json.endsWith('"')) {
                json = json.slice(1, -1);
              }
              json = json.replace(/""/g, '"');
              return `'${json.replace(/'/g, "''")}'::jsonb`;
            }
            return `'${sqlEscapeGlobal(v)}'`;
          }).join(', ');
          return `INSERT INTO contacts (${colNames}) VALUES (${colValues}) ON CONFLICT (organization_id, phone) DO NOTHING;`;
        });
      const sqlContentStr = sqlStatements.join('\n');
      setSqlContent(sqlContentStr);
      const sqlBlob = new Blob([sqlContentStr], { type: 'text/sql;charset=utf-8;' });
      setSqlDownloadUrl(URL.createObjectURL(sqlBlob));

      setLoading(false);
    }
    load();
  }, []);

  async function fetchAndGenerateMessagesSql() {
    if (cloudOnlyContacts.length === 0) return;
    setLoadingMessages(true);

    try {
      // Build a map: cloud contact_id -> phone
      const contactIdToPhone = new Map<string, string>();
      for (const c of cloudOnlyContacts) {
        contactIdToPhone.set(c.id, c.phone);
      }
      const contactIds = cloudOnlyContacts.map(c => c.id);

      // Fetch messages from Supabase using authenticated client
      const allMessages: any[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < contactIds.length; i += batchSize) {
        const batchIds = contactIds.slice(i, i + batchSize);
        
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('messages')
            .select('contact_id, content, message_type, media_url, direction, status, created_at, whatsapp_message_id, is_forwarded, forwarded_from, quoted_content, quoted_type')
            .in('contact_id', batchIds)
            .order('created_at', { ascending: true })
            .range(offset, offset + pageSize - 1);
          
          if (error) {
            console.error('Error fetching messages:', error);
            hasMore = false;
          } else if (data && data.length > 0) {
            allMessages.push(...data);
            offset += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }
      }

      setMsgCount(allMessages.length);

      if (allMessages.length === 0) {
        setMsgSql('-- Nenhuma mensagem encontrada para os contatos exclusivos do Cloud.');
        setShowMsgSql(true);
        setLoadingMessages(false);
        return;
      }

      // Generate SQL: resolve contact_id by phone via subquery
      const ORG_ID = '7483e12d-827c-4e6f-ac12-43d6fe67b0f8';
      const msgColumns = [
        'contact_id', 'organization_id', 'content', 'message_type', 'media_url',
        'direction', 'status', 'created_at', 'whatsapp_message_id', 'is_forwarded',
        'forwarded_from', 'quoted_content', 'quoted_type'
      ];

      const statements = allMessages.map(msg => {
        const phone = contactIdToPhone.get(msg.contact_id) || '';
        const contactSubquery = `(SELECT id FROM contacts WHERE phone = '${sqlEscapeGlobal(phone)}' AND organization_id = '${ORG_ID}' LIMIT 1)`;
        
        const values = [
          contactSubquery,
          `'${ORG_ID}'`,
          msg.content ? `'${sqlEscapeGlobal(msg.content)}'` : 'NULL',
          `'${sqlEscapeGlobal(msg.message_type || 'text')}'`,
          msg.media_url ? `'${sqlEscapeGlobal(msg.media_url)}'` : 'NULL',
          `'${sqlEscapeGlobal(msg.direction)}'`,
          `'${sqlEscapeGlobal(msg.status || 'sent')}'`,
          `'${sqlEscapeGlobal(msg.created_at)}'`,
          msg.whatsapp_message_id ? `'${sqlEscapeGlobal(msg.whatsapp_message_id)}'` : 'NULL',
          msg.is_forwarded ? 'true' : 'false',
          msg.forwarded_from ? `'${sqlEscapeGlobal(msg.forwarded_from)}'` : 'NULL',
          msg.quoted_content ? `'${sqlEscapeGlobal(msg.quoted_content)}'` : 'NULL',
          msg.quoted_type ? `'${sqlEscapeGlobal(msg.quoted_type)}'` : 'NULL',
        ];

        return `INSERT INTO messages (${msgColumns.join(', ')}) VALUES (${values.join(', ')});`;
      });

      const fullSql = statements.join('\n');
      setMsgSql(fullSql);
      setShowMsgSql(true);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setMsgSql(`-- Erro ao buscar mensagens: ${err}`);
      setShowMsgSql(true);
    }

    setLoadingMessages(false);
  }

  if (loading) return <div className="p-8 text-center">Carregando comparação...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Comparação de Contatos</h1>
      <div className="flex gap-4">
        <Badge variant="outline">Arquivo 1 (DB externo): {db1Count} contatos</Badge>
        <Badge variant="outline">Arquivo 2 (Cloud): {db2Count} contatos</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Apenas no Arquivo 1 (DB externo) — {onlyInDB1.length} contatos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {onlyInDB1.length === 0 ? (
                <p className="text-muted-foreground">Nenhum contato exclusivo</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left p-1">Nome</th><th className="text-left p-1">Telefone</th><th className="text-left p-1">Status</th></tr></thead>
                  <tbody>
                    {onlyInDB1.map(c => (
                      <tr key={c.phone} className="border-b">
                        <td className="p-1">{c.name}</td>
                        <td className="p-1 font-mono text-xs">{c.phone}</td>
                        <td className="p-1">{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Apenas no Arquivo 2 (Cloud) — {onlyInDB2.length} contatos</span>
              <div className="flex gap-2">
                {sqlDownloadUrl && onlyInDB2.length > 0 && (
                  <a href={sqlDownloadUrl} download="contatos_faltando_insert.sql">
                    <Button size="sm" className="gap-1.5" variant="default">
                      <Database className="h-4 w-4" />
                      SQL (recomendado)
                    </Button>
                  </a>
                )}
                {csvDownloadUrl && onlyInDB2.length > 0 && (
                  <a href={csvDownloadUrl} download="contatos_faltando_db_externo.csv">
                    <Button size="sm" className="gap-1.5" variant="outline">
                      <Download className="h-4 w-4" />
                      CSV
                    </Button>
                  </a>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {onlyInDB2.length === 0 ? (
                <p className="text-muted-foreground">Nenhum contato exclusivo</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr><th className="text-left p-1">Nome</th><th className="text-left p-1">Telefone</th><th className="text-left p-1">Última msg</th><th className="text-left p-1">Unreads</th></tr></thead>
                  <tbody>
                    {onlyInDB2.map(c => (
                      <tr key={c.phone} className="border-b">
                        <td className="p-1">{c.name}</td>
                        <td className="p-1 font-mono text-xs">{c.phone}</td>
                        <td className="p-1 text-xs">{c.last_message_at?.slice(0, 16) || '-'}</td>
                        <td className="p-1">{c.unread_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {sqlContent && onlyInDB2.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>SQL Contatos ({onlyInDB2.length} INSERTs)</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowSql(!showSql)}>
                  {showSql ? 'Ocultar' : 'Mostrar'} SQL
                </Button>
                <Button size="sm" onClick={() => { navigator.clipboard.writeText(sqlContent); }}>
                  Copiar SQL
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          {showSql && (
            <CardContent>
              <ScrollArea className="h-[400px]">
                <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-muted p-4 rounded">
                  {sqlContent}
                </pre>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}

      {/* Messages export section */}
      {onlyInDB2.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>
                <MessageSquare className="h-5 w-5 inline mr-2" />
                Exportar Mensagens dos Contatos Cloud-Only
                {msgCount > 0 && ` (${msgCount} mensagens)`}
              </span>
              <div className="flex gap-2">
                {!msgSql && (
                  <Button size="sm" onClick={fetchAndGenerateMessagesSql} disabled={loadingMessages}>
                    {loadingMessages && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    {loadingMessages ? 'Buscando...' : 'Gerar SQL de Mensagens'}
                  </Button>
                )}
                {msgSql && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setShowMsgSql(!showMsgSql)}>
                      {showMsgSql ? 'Ocultar' : 'Mostrar'} SQL
                    </Button>
                    <Button size="sm" onClick={() => { navigator.clipboard.writeText(msgSql); }}>
                      Copiar SQL
                    </Button>
                  </>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          {showMsgSql && msgSql && (
            <CardContent>
              <ScrollArea className="h-[400px]">
                <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-muted p-4 rounded">
                  {msgSql}
                </pre>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
