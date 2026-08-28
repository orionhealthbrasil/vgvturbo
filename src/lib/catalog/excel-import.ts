import * as XLSX from 'xlsx';

export interface ImportRow {
  sku?: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  tags?: string;
  preco: number;
  preco_promocional?: number | null;
  disponivel: boolean;
  tipo: 'product' | 'service';
  imagem_url1?: string;
  imagem_url2?: string;
  imagem_url3?: string;
}

export interface ParsedRow extends ImportRow {
  _row: number;
  _errors: string[];
}

const HEADERS = [
  'sku', 'nome', 'descricao', 'categoria', 'tags',
  'preco', 'preco_promocional', 'disponivel', 'tipo',
  'imagem_url1', 'imagem_url2', 'imagem_url3',
];

export function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const sample = [
    {
      sku: 'CAM-001',
      nome: 'Camiseta Premium',
      descricao: 'Camiseta 100% algodão, costura reforçada.',
      categoria: 'Roupas',
      tags: 'destaque, masculino',
      preco: 79.9,
      preco_promocional: 99.9,
      disponivel: 'sim',
      tipo: 'product',
      imagem_url1: 'https://exemplo.com/foto1.jpg',
      imagem_url2: '',
      imagem_url3: '',
    },
    {
      sku: 'SRV-001',
      nome: 'Consultoria 1h',
      descricao: 'Sessão de 1 hora.',
      categoria: 'Serviços',
      tags: '',
      preco: 250,
      preco_promocional: '',
      disponivel: 'sim',
      tipo: 'service',
      imagem_url1: '',
      imagem_url2: '',
      imagem_url3: '',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample, { header: HEADERS });
  ws['!cols'] = HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos');

  const instructions = [
    ['Instruções de importação'],
    [''],
    ['• Preencha uma linha por produto.'],
    ['• sku: opcional. Se preenchido e já existir, o produto será atualizado.'],
    ['• tipo: "product" (produto físico) ou "service" (serviço).'],
    ['• disponivel: sim/não ou true/false.'],
    ['• preco: valor em reais (use ponto ou vírgula).'],
    ['• preco_promocional: opcional. Se preenchido e maior que preco, exibe o valor riscado.'],
    ['• categoria: nome da categoria. Será criada se não existir.'],
    ['• tags: separadas por vírgula.'],
    ['• imagem_url1/2/3: URLs públicas de imagens.'],
  ];
  const wsI = XLSX.utils.aoa_to_sheet(instructions);
  wsI['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsI, 'Instruções');

  XLSX.writeFile(wb, 'modelo-catalogo.xlsx');
}

function toBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (v == null) return true;
  const s = String(v).trim().toLowerCase();
  return ['sim', 's', 'yes', 'y', 'true', '1', 'verdadeiro'].includes(s);
}

function toNum(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

export async function parseExcel(file: File): Promise<ParsedRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

  return rows.map((r, i) => {
    const errors: string[] = [];
    const nome = String(r.nome || '').trim();
    if (!nome) errors.push('Nome é obrigatório');
    const preco = toNum(r.preco);
    if (preco == null) errors.push('Preço inválido');
    const tipoRaw = String(r.tipo || 'product').trim().toLowerCase();
    const tipo = (tipoRaw === 'service' || tipoRaw === 'serviço' || tipoRaw === 'servico')
      ? 'service' : 'product';
    return {
      _row: i + 2,
      _errors: errors,
      sku: String(r.sku || '').trim() || undefined,
      nome,
      descricao: String(r.descricao || '').trim() || undefined,
      categoria: String(r.categoria || '').trim() || undefined,
      tags: String(r.tags || '').trim() || undefined,
      preco: preco ?? 0,
      preco_promocional: toNum(r.preco_promocional),
      disponivel: toBool(r.disponivel),
      tipo,
      imagem_url1: String(r.imagem_url1 || '').trim() || undefined,
      imagem_url2: String(r.imagem_url2 || '').trim() || undefined,
      imagem_url3: String(r.imagem_url3 || '').trim() || undefined,
    };
  });
}
