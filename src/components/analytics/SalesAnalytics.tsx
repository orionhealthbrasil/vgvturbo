import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, CheckCircle2, XCircle, Users, DollarSign,
  Percent, FileDown, ChevronDown, ChevronUp, BarChart2, Smile, CalendarIcon, Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSalesAnalytics, computeSalesStats, PERIODS, PeriodKey } from '@/hooks/useSalesAnalytics';
import { useUserOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];
const WON_COLOR = '#22c55e';
const LOST_COLOR = '#ef4444';

const currency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const pct = (v: number) => `${v.toFixed(1)}%`;

const truncate = (s: string, n = 16) => s.length > n ? s.slice(0, n).trimEnd() + '…' : s;

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  email: 'E-mail',
  phone: 'Telefone',
};

function channelLabel(ch: string) {
  return CHANNEL_LABELS[ch.toLowerCase()] ?? ch;
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
interface SatisfactionResponse {
  id: string;
  contactName: string | null;
  assignedName: string | null;
  submittedAt: string;
  rating: number | null;
  comment: string | null;
  textAnswers: { question: string; answer: string }[];
}

interface SatisfactionSummary {
  totalResponses: number;
  averageRating: number | null;
  distribution: Record<number, number>;
  responses: SatisfactionResponse[];
}

function exportPDF(
  period: string,
  stats: ReturnType<typeof computeSalesStats>,
  vendorFilter: string,
  vendorName: string | null,
  orgName: string,
  satisfaction: SatisfactionSummary | null,
  tagName?: string | null,
) {
  const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const isIndividual = vendorFilter !== 'all' && vendorName;

  const C = { won: '#10b981', lost: '#f43f5e', other: '#f59e0b', brand: '#6366f1', muted: '#94a3b8' };
  const AV_COLORS = ['#6366f1','#10b981','#f59e0b','#06b6d4','#8b5cf6','#ec4899','#f43f5e'];

  // SVG donut: each segment rendered via stroke-dasharray + rotation from 12 o'clock
  function svgDonut(segs: { value: number; color: string }[], size: number) {
    const cx = size / 2, cy = size / 2;
    const sw = Math.round(size * 0.155);
    const r = cx - sw / 2 - 3;
    const circ = 2 * Math.PI * r;
    const total = segs.reduce((s, d) => s + d.value, 0);
    if (!total) return `<svg width="${size}" height="${size}"><text x="50%" y="54%" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="11">Sem dados</text></svg>`;
    let accDeg = 0;
    const slices = segs.map((seg) => {
      const dash = (seg.value / total) * circ;
      const el = `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="${seg.color}" stroke-width="${sw}" stroke-linecap="butt" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" stroke-dashoffset="${(circ / 4).toFixed(2)}" transform="rotate(${accDeg.toFixed(2)},${cx},${cy})"/>`;
      accDeg += (seg.value / total) * 360;
      return el;
    });
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="#eaecf4" stroke-width="${sw}"/>${slices.join('')}</svg>`;
  }

  // Horizontal bar row
  function hBar(label: string, value: number, max: number, color: string, sub: string) {
    const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px"><span style="font-size:13px;color:#334155;flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${label}</span><span style="font-size:13px;font-weight:700;color:${color};white-space:nowrap;font-variant-numeric:tabular-nums">${value} <span style="font-weight:400;font-size:11px;color:#94a3b8">${sub}</span></span></div><div style="height:7px;border-radius:99px;background:#edf0f7;overflow:hidden"><div style="height:100%;width:${w.toFixed(1)}%;background:${color};border-radius:99px"></div></div></div>`;
  }

  // ── Pre-compute all HTML fragments ──────────────────────────────────────────

  // Donut
  const donutSegs = ([
    { label: 'Realizadas', value: stats.won, color: C.won },
    { label: 'Perdidas', value: stats.lost, color: C.lost },
    { label: 'Curiosos e outros', value: stats.other, color: C.other },
    { label: 'Sem resultado', value: stats.noResult, color: C.muted },
  ] as { label: string; value: number; color: string }[]).filter((d) => d.value > 0);
  const donutTotal = donutSegs.reduce((s, d) => s + d.value, 0);
  const donutSvg = svgDonut(donutSegs, 152);
  const donutLegendHtml = donutSegs.map((d) =>
    `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9"><span style="width:9px;height:9px;border-radius:50%;background:${d.color};flex-shrink:0"></span><span style="font-size:12px;color:#64748b;flex:1">${d.label}</span><span style="font-size:13px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums">${d.value}</span><span style="font-size:11px;color:#94a3b8;width:42px;text-align:right">${donutTotal > 0 ? ((d.value / donutTotal) * 100).toFixed(1) : 0}%</span></div>`
  ).join('');

  // KPI cards
  const kpiItems = [
    { l: 'CONVERSAS', s: 'Finalizadas', v: String(stats.total), c: C.brand },
    { l: 'REALIZADAS', s: 'Vendas ganhas', v: String(stats.won), c: C.won },
    { l: 'PERDIDAS', s: 'Vendas perdidas', v: String(stats.lost), c: C.lost },
    { l: 'CURIOSOS', s: 'e outros', v: String(stats.other), c: C.other },
    { l: 'CONVERSÃO', s: 'Taxa geral', v: pct(stats.conversionRate), c: C.brand },
    { l: 'VALOR GANHO', s: 'Total realizado', v: currency(stats.wonValue), c: C.won },
    { l: 'VALOR PERDIDO', s: 'Estimado', v: currency(stats.lostValue), c: C.lost },
  ];
  const kpiHtml = kpiItems.map((k) =>
    `<div style="background:#fff;border:1px solid #e4e8f0;border-radius:10px;padding:14px 16px;border-left:3px solid ${k.c}"><div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#94a3b8;margin-bottom:7px">${k.l}</div><div style="font-size:22px;font-weight:800;color:#0c1524;line-height:1.1;margin-bottom:3px;font-variant-numeric:tabular-nums;word-break:break-all">${k.v}</div><div style="font-size:10.5px;color:#94a3b8">${k.s}</div></div>`
  ).join('');

  // Funnel steps
  const fTotal = stats.total + stats.other;
  const fSteps = [
    { label: 'Total entradas', v: fTotal, c: C.brand },
    { label: 'Realizadas', v: stats.won, c: C.won },
    { label: 'Perdidas', v: stats.lost, c: C.lost },
    { label: 'Curiosos', v: stats.other, c: C.other },
  ];
  const funnelHtml = fSteps.map((s) => {
    const w = fTotal > 0 ? Math.max(6, (s.v / fTotal) * 100) : 6;
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px"><div style="font-size:11px;color:#64748b;width:85px;flex-shrink:0">${s.label}</div><div style="flex:1;height:26px;background:#edf0f7;border-radius:6px;overflow:hidden"><div style="height:100%;width:${w.toFixed(1)}%;background:${s.c};border-radius:6px;display:flex;align-items:center;padding:0 9px"><span style="font-size:12px;font-weight:700;color:#fff;white-space:nowrap">${s.v}</span></div></div><div style="font-size:12px;font-weight:700;color:${s.c};width:42px;text-align:right;white-space:nowrap">${fTotal > 0 ? ((s.v / fTotal) * 100).toFixed(1) : 0}%</div></div>`;
  }).join('');

  // Vendor cards
  const vendorHtml = stats.vendorStats.map((v, i) => {
    const init = v.name.replace(/[|]/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
    const cc = v.conversionRate >= 20 ? C.won : v.conversionRate >= 10 ? C.other : C.lost;
    const chips = v.lossReasonsList.slice(0, 3).map((r) =>
      `<span style="font-size:10.5px;color:#64748b;background:#f8fafc;border:1px solid #e4e8f0;padding:2px 7px;border-radius:5px">${r.label} <b style="color:${C.lost}">(${r.count})</b></span>`
    ).join('');
    const convBar = `<div style="height:5px;background:#edf0f7;border-radius:3px;overflow:hidden;margin-bottom:3px"><div style="height:100%;width:${Math.min(v.conversionRate, 100).toFixed(1)}%;background:${cc};border-radius:3px"></div></div>`;
    return `<div style="background:#fff;border:1px solid #e4e8f0;border-radius:12px;padding:16px;break-inside:avoid"><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div style="width:38px;height:38px;border-radius:9px;background:${AV_COLORS[i % AV_COLORS.length]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${init}</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:#0c1524;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${v.name}</div><div style="font-size:11px;color:#94a3b8">${v.total} conversas</div></div><div style="font-size:19px;font-weight:800;color:${cc}">${pct(v.conversionRate)}</div></div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px"><span style="background:${C.won}16;color:${C.won};font-size:11px;font-weight:600;padding:3px 8px;border-radius:5px">${v.won} ganhas</span><span style="background:${C.lost}16;color:${C.lost};font-size:11px;font-weight:600;padding:3px 8px;border-radius:5px">${v.lost} perdidas</span></div>${convBar}<div style="font-size:9.5px;color:#94a3b8;text-align:right;margin-bottom:${chips ? '10' : '0'}px">taxa de conversão</div>${chips ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${chips}</div>` : ''}</div>`;
  }).join('');

  // Loss reason bars
  const lossMax = stats.lossReasons[0]?.count || 1;
  const lossBarsHtml = stats.lossReasons.map((r) =>
    hBar(r.label, r.count, lossMax, C.lost, stats.lost > 0 ? `${((r.count / stats.lost) * 100).toFixed(1)}% das perdas` : '')
  ).join('');

  // Channel bars
  const chMax = stats.channels[0]?.count || 1;
  const channelBarsHtml = stats.channels.map((c, i) =>
    hBar(channelLabel(c.label), c.count, chMax, COLORS[i % COLORS.length], stats.won > 0 ? `${((c.count / stats.won) * 100).toFixed(1)}% das vendas` : '')
  ).join('');

  // ── HTML ────────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Relatório de Vendas</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:#eef1f7;-webkit-print-color-adjust:exact;print-color-adjust:exact;min-height:100vh}
.page{max-width:960px;margin:0 auto;background:#eef1f7}
/* HEADER */
.hdr{background:#0c1524;padding:28px 32px 24px;border-bottom:3px solid #6366f1}
.hdr-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.hdr-badge{background:rgba(99,102,241,.18);color:#a5b4fc;font-size:11px;font-weight:600;padding:5px 13px;border-radius:20px;border:1px solid rgba(99,102,241,.28);white-space:nowrap}
.hdr h1{font-size:26px;font-weight:800;color:#fff;margin-bottom:5px;letter-spacing:-.5px}
.hdr-meta{font-size:12px;color:#4e617a}
/* BODY */
.body{padding:24px 32px 32px}
/* SECTION */
.sec{margin-bottom:30px}
.sec-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.11em;color:#6366f1;margin-bottom:13px;display:flex;align-items:center;gap:9px}
.sec-title::after{content:'';flex:1;height:1px;background:#d8dff0}
/* KPI */
.kgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
/* BOX */
.box{background:#fff;border:1px solid #e0e6f2;border-radius:12px;padding:18px}
.box-t{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748b;margin-bottom:14px}
/* OVERVIEW */
.orow{display:grid;grid-template-columns:205px 1fr;gap:14px;align-items:start}
/* VENDOR */
.vgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
/* CHARTS */
.crow{display:grid;grid-template-columns:1fr 1fr;gap:14px}
/* FOOTER */
.ftr{padding:14px 32px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #d8dff0;background:#fff}
.ftr span{font-size:11px;color:#94a3b8}
/* MOBILE */
@media(max-width:620px){
  .hdr{padding:18px 16px}
  .body{padding:14px 16px 24px}
  .kgrid{grid-template-columns:repeat(2,1fr)}
  .orow,.crow{grid-template-columns:1fr}
  .vgrid{grid-template-columns:1fr}
  .hdr h1{font-size:21px}
}
/* PRINT */
@media print{
  body,div.page{background:#fff}
  .hdr{padding:20px 24px 18px}
  .body{padding:18px 24px 24px}
  .kgrid{grid-template-columns:repeat(4,1fr)}
  .orow{grid-template-columns:205px 1fr}
  .vgrid{grid-template-columns:repeat(2,1fr)}
  .crow{grid-template-columns:1fr 1fr}
  .sec{break-inside:avoid}
  @page{margin:0;size:A4}
}
</style>
</head>
<body>
<div class="page">

<div class="hdr">
  <div class="hdr-top">
    <div>
      <div style="font-size:12px;font-weight:600;color:#a5b4fc;letter-spacing:.05em;margin-bottom:4px;text-transform:uppercase">${orgName}</div>
      <h1>${isIndividual ? `Relatório Individual — ${vendorName}` : 'Relatório de Vendas'}</h1>
      <div class="hdr-meta">${period}${tagName ? ` &nbsp;·&nbsp; Tag: ${tagName}` : ''} &nbsp;·&nbsp; Gerado em ${now}</div>
    </div>
    <div class="hdr-badge">VGV Turbo CRM</div>
  </div>
</div>

<div class="body">

  <div class="sec">
    <div class="sec-title">Resumo do período</div>
    <div class="kgrid">${kpiHtml}</div>
  </div>

  <div class="sec">
    <div class="sec-title">Distribuição e funil</div>
    <div class="orow">
      <div class="box">
        <div class="box-t" style="text-align:center">Por resultado</div>
        <div style="display:flex;justify-content:center;margin-bottom:16px">${donutSvg}</div>
        ${donutLegendHtml}
      </div>
      <div class="box">
        <div class="box-t">Funil de conversão</div>
        ${funnelHtml}
        <div style="margin-top:18px;padding-top:16px;border-top:1px solid #edf0f7">
          <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:.07em;font-weight:600">Taxa de conversão geral</div>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="flex:1;height:10px;background:#edf0f7;border-radius:99px;overflow:hidden"><div style="height:100%;width:${Math.min(stats.conversionRate,100).toFixed(1)}%;background:#6366f1;border-radius:99px"></div></div>
            <span style="font-size:16px;font-weight:800;color:#6366f1;font-variant-numeric:tabular-nums">${pct(stats.conversionRate)}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  ${stats.vendorStats.length > 0 ? `
  <div class="sec">
    <div class="sec-title">Desempenho por vendedor</div>
    <div class="vgrid">${vendorHtml}</div>
  </div>` : ''}

  ${(stats.lossReasons.length > 0 || stats.channels.length > 0) ? `
  <div class="sec">
    <div class="sec-title">Análise detalhada</div>
    <div class="crow">
      ${stats.lossReasons.length > 0 ? `<div class="box"><div class="box-t">Motivos de perda</div>${lossBarsHtml}</div>` : ''}
      ${stats.channels.length > 0 ? `<div class="box"><div class="box-t">Canal das vendas realizadas</div>${channelBarsHtml}</div>` : ''}
    </div>
  </div>` : ''}

  ${satisfaction && satisfaction.totalResponses > 0 ? (() => {
    const avg = satisfaction.averageRating ?? 0;
    const distBars = [5,4,3,2,1].map((s) => {
      const count = satisfaction.distribution[s] || 0;
      const w = satisfaction.totalResponses > 0 ? (count / satisfaction.totalResponses) * 100 : 0;
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px"><span style="font-size:12px;color:#64748b;width:18px;text-align:right">${s}★</span><div style="flex:1;height:8px;background:#edf0f7;border-radius:99px;overflow:hidden"><div style="height:100%;width:${w.toFixed(1)}%;background:#f59e0b;border-radius:99px"></div></div><span style="font-size:12px;color:#64748b;width:28px;text-align:right">${count}</span></div>`;
    }).join('');

    const responseCards = satisfaction.responses.map((r) => {
      const starsFilled = r.rating ? '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) : '—';
      const starColor = r.rating && r.rating >= 4 ? '#10b981' : r.rating && r.rating <= 2 ? '#f43f5e' : '#f59e0b';
      const dateStr = new Date(r.submittedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const texts = r.textAnswers;
      const commentHtml = r.comment && String(r.comment).trim() && isNaN(Number(r.comment))
        ? `<div style="margin-top:8px;padding:8px 10px;background:#f8fafc;border-left:3px solid #f59e0b;border-radius:0 6px 6px 0;font-size:12px;color:#334155;font-style:italic">"${String(r.comment).replace(/"/g, '&quot;')}"</div>`
        : '';
      const textsHtml = texts.map(t => `<div style="margin-top:6px;padding:6px 10px;background:#f0f9ff;border-left:3px solid #6366f1;border-radius:0 6px 6px 0"><div style="font-size:10px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">${t.question.replace(/</g, '&lt;')}</div><div style="font-size:12px;color:#334155">${t.answer.replace(/</g, '&lt;')}</div></div>`).join('');
      return `<div style="background:#fff;border:1px solid #e4e8f0;border-radius:10px;padding:12px 14px;break-inside:avoid">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div style="font-size:13px;font-weight:600;color:#0c1524">${r.contactName || 'Anônimo'}</div>
          <div style="display:flex;align-items:center;gap:10px">
            ${r.assignedName ? `<span style="font-size:11px;color:#94a3b8">${r.assignedName}</span>` : ''}
            <span style="font-size:14px;color:${starColor}">${starsFilled}</span>
            <span style="font-size:11px;color:#94a3b8;white-space:nowrap">${dateStr}</span>
          </div>
        </div>
        ${commentHtml}${textsHtml}
      </div>`;
    }).join('');

    return `<div class="sec">
    <div class="sec-title">Satisfação dos clientes — ${satisfaction.totalResponses} avaliações no período</div>
    <div class="crow" style="margin-bottom:16px">
      <div class="box">
        <div class="box-t">Média geral</div>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
          <div style="font-size:44px;font-weight:800;color:#f59e0b;line-height:1">${avg.toFixed(1)}</div>
          <div>
            <div style="font-size:16px;color:#f59e0b;margin-bottom:4px">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5-Math.round(avg))}</div>
            <div style="font-size:12px;color:#94a3b8">${satisfaction.totalResponses} resposta${satisfaction.totalResponses !== 1 ? 's' : ''}</div>
          </div>
        </div>
        ${distBars}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${responseCards}</div>
    </div>
  </div>`;
  })() : ''}

</div>

<div class="ftr">
  <span>VGV Turbo CRM &mdash; Relatório gerado automaticamente</span>
  <span>${now}</span>
</div>
</div>
<script>document.fonts.ready.then(function(){setTimeout(function(){window.print()},400)})</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

// ─── Main component ───────────────────────────────────────────────────────────
export function SalesAnalytics() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [vendorFilter, setVendorFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);

  const { data: orgData } = useUserOrganization();
  const orgId = orgData?.organization.id;
  const orgName = orgData?.organization.name ?? 'VGV Turbo';

  const { data: orgTags = [] } = useQuery({
    queryKey: ['org-tags-analytics', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('organization_id', orgId)
        .order('name');
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const { contacts, vendorMap, isLoading, isOwnerOrAdmin } = useSalesAnalytics(
    period, customFrom, customTo,
    tagFilter !== 'all' ? tagFilter : undefined,
  );

  const allStats = useMemo(() => computeSalesStats(contacts, vendorMap), [contacts, vendorMap]);

  // Compute period cutoff/ceiling for satisfaction query (mirrors useSalesAnalytics logic)
  const { satisfactionCutoff, satisfactionCeiling } = useMemo(() => {
    if (period === 'custom') {
      const from = customFrom ? new Date(customFrom) : null;
      if (from) from.setHours(0, 0, 0, 0);
      const to = customTo ? new Date(customTo) : null;
      if (to) to.setHours(23, 59, 59, 999);
      return { satisfactionCutoff: from?.toISOString() ?? null, satisfactionCeiling: to?.toISOString() ?? null };
    }
    if (period === 'today') {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      return { satisfactionCutoff: d.toISOString(), satisfactionCeiling: null };
    }
    const days = PERIODS.find((p) => p.key === period)?.days;
    if (!days) return { satisfactionCutoff: null, satisfactionCeiling: null };
    const d = new Date(); d.setDate(d.getDate() - days);
    return { satisfactionCutoff: d.toISOString(), satisfactionCeiling: null };
  }, [period, customFrom, customTo]);

  // Fetch satisfaction for the current period with full response data
  const { data: satisfactionData } = useQuery({
    queryKey: ['satisfaction-summary-pdf', orgId, satisfactionCutoff, satisfactionCeiling],
    queryFn: async (): Promise<SatisfactionSummary> => {
      // Fetch survey questions to map q_XXXX keys → labels
      const { data: surveyData } = await supabase
        .from('satisfaction_surveys')
        .select('questions')
        .eq('organization_id', orgId!)
        .maybeSingle();
      const questionMap: Record<string, string> = {};
      for (const q of (surveyData?.questions as any[] || [])) {
        if (q.id && q.label) questionMap[q.id] = q.label;
      }

      let q = supabase
        .from('satisfaction_responses')
        .select('id, rating, answers, submitted_at, contact_id, assigned_to')
        .eq('organization_id', orgId!)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false });
      if (satisfactionCutoff) q = q.gte('submitted_at', satisfactionCutoff);
      if (satisfactionCeiling) q = q.lte('submitted_at', satisfactionCeiling);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];

      // Fetch contact names
      const contactIds = [...new Set(rows.map((r: any) => r.contact_id).filter(Boolean))];
      const contactMap: Record<string, string> = {};
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase.from('contacts').select('id, name').in('id', contactIds);
        for (const c of contacts || []) contactMap[c.id] = c.name || 'Anônimo';
      }

      // Fetch assigned_to names
      const assignedIds = [...new Set(rows.map((r: any) => r.assigned_to).filter(Boolean))];
      const profileMap: Record<string, string> = {};
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', assignedIds);
        for (const p of profiles || []) profileMap[p.user_id] = p.full_name || '';
      }

      const ratings = rows.map((r: any) => r.rating).filter((r: any) => typeof r === 'number');
      const distribution: Record<number, number> = {};
      for (const r of ratings) distribution[r] = (distribution[r] || 0) + 1;
      const avg = ratings.length > 0 ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : null;

      const responses: SatisfactionResponse[] = rows.map((r: any) => {
        const ans = (r.answers as Record<string, any>) || {};
        const comment = ans.comment ?? null;
        const textAnswers = Object.entries(ans)
          .filter(([k]) => k.startsWith('q_'))
          .map(([k, v]) => ({
            question: questionMap[k] || k,
            answer: String(v),
          }))
          .filter((t) => t.answer);
        return {
          id: r.id,
          contactName: r.contact_id ? (contactMap[r.contact_id] || 'Anônimo') : 'Anônimo',
          assignedName: r.assigned_to ? (profileMap[r.assigned_to] || null) : null,
          submittedAt: r.submitted_at,
          rating: r.rating,
          comment: comment !== null ? String(comment) : null,
          textAnswers,
        };
      });

      return { totalResponses: rows.length, averageRating: avg, distribution, responses };
    },
    enabled: !!orgId,
  });

  const filteredContacts = useMemo(() =>
    vendorFilter === 'all' ? contacts : contacts.filter((c) => c.assigned_to === vendorFilter),
    [contacts, vendorFilter]);

  const stats = useMemo(() => computeSalesStats(filteredContacts, vendorMap), [filteredContacts, vendorMap]);

  const vendorOptions = useMemo(() => {
    return allStats.vendorStats.map((v) => ({ id: v.id, name: v.name }));
  }, [allStats.vendorStats]);

  const barData = useMemo(() =>
    stats.vendorStats.map((v) => ({
      name: truncate(v.name, 14),
      fullName: v.name,
      Ganhas: v.won,
      Perdidas: v.lost,
    })),
    [stats.vendorStats]);

  const pieData = useMemo(() =>
    stats.lossReasons.slice(0, 8).map((r, i) => ({
      name: r.label,
      value: r.count,
      fill: COLORS[i % COLORS.length],
    })),
    [stats.lossReasons]);

  const channelData = useMemo(() =>
    stats.channels.map((c, i) => ({
      name: channelLabel(c.label),
      value: c.count,
      fill: COLORS[i % COLORS.length],
    })),
    [stats.channels]);

  const periodLabel = period === 'custom' && (customFrom || customTo)
    ? `${customFrom ? format(customFrom, 'dd/MM/yyyy') : '?'} → ${customTo ? format(customTo, 'dd/MM/yyyy') : 'hoje'}`
    : PERIODS.find((p) => p.key === period)?.label ?? '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-500" />
            Análise das Vendas
          </h2>
          <p className="text-sm text-muted-foreground">
            Desempenho de vendas, motivos de perda e canais no período selecionado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={period} onValueChange={(v) => {
            setPeriod(v as PeriodKey);
            if (v !== 'custom') { setCustomFrom(undefined); setCustomTo(undefined); }
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {period === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-[140px] justify-start text-left font-normal gap-2', !customFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="h-4 w-4" />
                    {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'Data inicial'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} locale={ptBR} initialFocus className="p-3 pointer-events-auto" disabled={(d) => customTo ? d > customTo : false} />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-[140px] justify-start text-left font-normal gap-2', !customTo && 'text-muted-foreground')}>
                    <CalendarIcon className="h-4 w-4" />
                    {customTo ? format(customTo, 'dd/MM/yyyy') : 'Data final'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} locale={ptBR} initialFocus className="p-3 pointer-events-auto" disabled={(d) => d > new Date() || (customFrom ? d < customFrom : false)} />
                </PopoverContent>
              </Popover>
            </>
          )}

          {isOwnerOrAdmin && vendorOptions.length > 0 && (
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {vendorOptions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {orgTags.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[160px]">
                <Tag className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                <SelectValue placeholder="Todas as tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tags</SelectItem>
                {orgTags.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color ?? '#94a3b8' }} />
                      {t.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              const vendorName = vendorFilter !== 'all'
                ? (vendorOptions.find(v => v.id === vendorFilter)?.name ?? null)
                : null;
              const tagName = tagFilter !== 'all'
                ? ((orgTags as any[]).find((t: any) => t.id === tagFilter)?.name ?? null)
                : null;
              exportPDF(periodLabel, stats, vendorFilter, vendorName, orgName, satisfactionData ?? null, tagName);
            }}
          >
            <FileDown className="w-4 h-4" />
            {vendorFilter !== 'all' ? 'Exportar PDF Individual' : 'Exportar PDF'}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard icon={<Users className="w-4 h-4 text-slate-500" />} label="Finalizadas" value={String(stats.total)} loading={isLoading} />
        <KpiCard icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} label="Realizadas" value={String(stats.won)} loading={isLoading} className="border-emerald-200 dark:border-emerald-800" valueClassName="text-emerald-600 dark:text-emerald-400" />
        <KpiCard icon={<XCircle className="w-4 h-4 text-rose-500" />} label="Perdidas" value={String(stats.lost)} loading={isLoading} className="border-rose-200 dark:border-rose-800" valueClassName="text-rose-600 dark:text-rose-400" />
        <KpiCard icon={<Smile className="w-4 h-4 text-amber-500" />} label="Curiosos e outros" value={String(stats.other)} loading={isLoading} className="border-amber-200 dark:border-amber-800" valueClassName="text-amber-600 dark:text-amber-400" />
        <KpiCard icon={<Percent className="w-4 h-4 text-indigo-500" />} label="Conversão" value={pct(stats.conversionRate)} loading={isLoading} className="border-indigo-200 dark:border-indigo-800" valueClassName="text-indigo-600 dark:text-indigo-400" />
        <KpiCard icon={<TrendingUp className="w-4 h-4 text-emerald-500" />} label="Valor ganho" value={currency(stats.wonValue)} loading={isLoading} className="border-emerald-200 dark:border-emerald-800" valueClassName="text-emerald-600 dark:text-emerald-400" />
        <KpiCard icon={<TrendingDown className="w-4 h-4 text-rose-500" />} label="Valor perdido" value={currency(stats.lostValue)} loading={isLoading} className="border-rose-200 dark:border-rose-800" valueClassName="text-rose-600 dark:text-rose-400" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart — vendors */}
        {isOwnerOrAdmin && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ganhas vs. Perdidas por vendedor</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="w-full h-[240px]" /> : barData.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={barData} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-12} textAnchor="end" height={52} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 13 }}
                      formatter={(v: any, name: string) => [v, name]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Ganhas" fill={WON_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Perdidas" fill={LOST_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pie — loss reasons */}
        <Card className={!isOwnerOrAdmin ? 'lg:col-span-2' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Motivos de perda</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="w-full h-[240px]" /> : pieData.length === 0 ? <Empty text="Sem perdas registradas." /> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="40%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={2}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, name: string) => [`${v} (${stats.lost > 0 ? pct((v / stats.lost) * 100) : '0%'})`, name]}
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, lineHeight: '18px' }} formatter={(v: string) => truncate(v, 20)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie — channels (only if won > 0 and has channel data) */}
        {channelData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Canal das vendas realizadas</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="w-full h-[240px]" /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={channelData} dataKey="value" nameKey="name" cx="40%" cy="50%" outerRadius={80} innerRadius={48} paddingAngle={2}>
                      {channelData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, name: string) => [`${v} (${stats.won > 0 ? pct((v / stats.won) * 100) : '0%'})`, name]}
                    />
                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, lineHeight: '18px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Vendor table (admin/owner only) */}
      {isOwnerOrAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Desempenho por vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : stats.vendorStats.length === 0 ? (
              <Empty />
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Finalizadas</TableHead>
                      <TableHead className="text-right">Ganhas</TableHead>
                      <TableHead className="text-right">Perdidas</TableHead>
                      <TableHead className="text-right">Conversão</TableHead>
                      <TableHead className="text-right">Valor ganho</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.vendorStats.map((v) => (
                      <>
                        <TableRow
                          key={v.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedVendor(expandedVendor === v.id ? null : v.id)}
                        >
                          <TableCell className="font-medium">{v.name}</TableCell>
                          <TableCell className="text-right">{v.total}</TableCell>
                          <TableCell className="text-right">
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{v.won}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-rose-600 dark:text-rose-400 font-medium">{v.lost}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={v.conversionRate >= 50 ? 'default' : 'secondary'} className={v.conversionRate >= 50 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : ''}>
                              {pct(v.conversionRate)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                            {currency(v.wonValue)}
                          </TableCell>
                          <TableCell>
                            {expandedVendor === v.id
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                          </TableCell>
                        </TableRow>

                        {/* Expanded detail row */}
                        {expandedVendor === v.id && (
                          <TableRow key={`${v.id}-detail`} className="bg-muted/20">
                            <TableCell colSpan={7} className="py-3 px-6">
                              {v.lossReasonsList.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Sem motivos de perda registrados.</p>
                              ) : (
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Motivos de perda</p>
                                  <div className="flex flex-wrap gap-2">
                                    {v.lossReasonsList.map((r, i) => (
                                      <span key={r.label} className="inline-flex items-center gap-1.5 rounded-full bg-background border px-3 py-1 text-xs font-medium">
                                        <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                                        {r.label}
                                        <span className="text-muted-foreground">({r.count})</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loss reasons detail table */}
      {stats.lossReasons.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500" />
              Detalhamento dos motivos de perda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">% das perdas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.lossReasons.map((r, i) => (
                    <TableRow key={r.label}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        {r.label}
                      </TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {stats.lost > 0 ? pct((r.count / stats.lost) * 100) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
  className?: string;
  valueClassName?: string;
}

function KpiCard({ icon, label, value, loading, className = '', valueClassName = '' }: KpiCardProps) {
  return (
    <Card className={className}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20 mt-1" />
        ) : (
          <p className={`text-xl font-bold truncate ${valueClassName}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Empty({ text = 'Nenhum dado no período.' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">{text}</div>
  );
}
