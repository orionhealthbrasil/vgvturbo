import { useEffect } from 'react';

const HTML_STYLE = `
  @media (prefers-color-scheme: dark) {
    :root { color-scheme: dark; }
  }

  .pcg {
    --ink: #142B33;
    --ink-soft: #4B6169;
    --ink-faint: #7C8E93;
    --paper: #EEF2F1;
    --paper-raised: #FFFFFF;
    --paper-sunken: #E3E9E7;
    --line: rgba(20,43,51,0.14);
    --line-strong: rgba(20,43,51,0.28);

    --brand: #0E7C86;
    --brand-ink: #063E44;
    --swim: #0E7C86;
    --swim-tint: #DEF0EF;
    --bike: #93630F;
    --bike-tint: #F3E7CB;
    --run: #8C2A48;
    --run-tint: #F3DCE4;
    --strength: #4A5860;
    --strength-tint: #E4E8E9;
    --rest-tint: #E9EBE9;
    --brick: #5B4C96;
    --brick-tint: #E7E3F3;
    --warn: #B2490F;
    --warn-tint: #F7E0CE;

    --font-display: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    --font-body: Georgia, "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
    --font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    --font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Consolas, monospace;

    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-body);
    line-height: 1.6;
    display: block;
    min-height: 100vh;
  }

  .pcg[data-theme-dark],
  html[data-theme="dark"] .pcg {
    --ink: #E7EEEC;
    --ink-soft: #AFC2C0;
    --ink-faint: #7E938F;
    --paper: #0E1B1F;
    --paper-raised: #152428;
    --paper-sunken: #0A1518;
    --line: rgba(231,238,236,0.14);
    --line-strong: rgba(231,238,236,0.26);

    --brand: #45BEC4;
    --brand-ink: #BFEEF0;
    --swim: #45BEC4;
    --swim-tint: #123638;
    --bike: #D9A94A;
    --bike-tint: #33290F;
    --run: #E08AA6;
    --run-tint: #3A1723;
    --strength: #A9B7BC;
    --strength-tint: #232F32;
    --rest-tint: #1B2528;
    --brick: #B0A0E6;
    --brick-tint: #251F3B;
    --warn: #F0995B;
    --warn-tint: #3A230F;
  }

  @media (prefers-color-scheme: dark) {
    .pcg:not([data-theme-light]) {
      --ink: #E7EEEC;
      --ink-soft: #AFC2C0;
      --ink-faint: #7E938F;
      --paper: #0E1B1F;
      --paper-raised: #152428;
      --paper-sunken: #0A1518;
      --line: rgba(231,238,236,0.14);
      --line-strong: rgba(231,238,236,0.26);

      --brand: #45BEC4;
      --brand-ink: #BFEEF0;
      --swim: #45BEC4;
      --swim-tint: #123638;
      --bike: #D9A94A;
      --bike-tint: #33290F;
      --run: #E08AA6;
      --run-tint: #3A1723;
      --strength: #A9B7BC;
      --strength-tint: #232F32;
      --rest-tint: #1B2528;
      --brick: #B0A0E6;
      --brick-tint: #251F3B;
      --warn: #F0995B;
      --warn-tint: #3A230F;
    }
  }

  html[data-theme="light"] .pcg {
    --ink: #142B33;
    --ink-soft: #4B6169;
    --ink-faint: #7C8E93;
    --paper: #EEF2F1;
    --paper-raised: #FFFFFF;
    --paper-sunken: #E3E9E7;
    --line: rgba(20,43,51,0.14);
    --line-strong: rgba(20,43,51,0.28);
    --brand: #0E7C86;
    --swim: #0E7C86;
    --swim-tint: #DEF0EF;
    --bike: #93630F;
    --bike-tint: #F3E7CB;
    --run: #8C2A48;
    --run-tint: #F3DCE4;
    --strength: #4A5860;
    --strength-tint: #E4E8E9;
    --rest-tint: #E9EBE9;
    --brick: #5B4C96;
    --brick-tint: #E7E3F3;
    --warn: #B2490F;
    --warn-tint: #F7E0CE;
  }

  .pcg * { box-sizing: border-box; }

  .pcg .wrap {
    max-width: 1040px;
    margin: 0 auto;
    padding: 0 20px 96px;
  }

  .pcg .masthead {
    padding: 48px 0 32px;
    border-bottom: 1px solid var(--line);
  }
  .pcg .eyebrow {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--brand);
    margin: 0 0 10px;
  }
  .pcg h1 {
    font-family: var(--font-display);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.01em;
    font-size: clamp(1.9rem, 4.6vw, 2.9rem);
    line-height: 1.05;
    margin: 0 0 6px;
    text-wrap: balance;
    color: var(--ink);
  }
  .pcg .subhead {
    font-family: var(--font-body);
    font-style: italic;
    color: var(--ink-soft);
    font-size: 1.05rem;
    margin: 0 0 28px;
    max-width: 62ch;
  }

  .pcg .vitals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 1px;
    background: var(--line);
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
  }
  .pcg .vital {
    background: var(--paper-raised);
    padding: 14px 16px;
  }
  .pcg .vital .k {
    font-family: var(--font-ui);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--ink-faint);
    margin: 0 0 4px;
  }
  .pcg .vital .v {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--ink);
  }
  .pcg .vital .v small {
    font-family: var(--font-ui);
    font-weight: 400;
    font-size: 0.7rem;
    color: var(--ink-faint);
    display: block;
    margin-top: 2px;
  }

  .pcg nav.weeknav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 20px 0;
    border-bottom: 1px solid var(--line);
    margin-bottom: 36px;
    position: sticky;
    top: 0;
    background: var(--paper);
    z-index: 5;
  }
  .pcg nav.weeknav a {
    font-family: var(--font-ui);
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: none;
    color: var(--ink-soft);
    background: var(--paper-raised);
    border: 1px solid var(--line);
    padding: 6px 12px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .pcg nav.weeknav a:hover,
  .pcg nav.weeknav a:focus-visible {
    border-color: var(--brand);
    color: var(--brand);
    outline: none;
  }
  .pcg nav.weeknav a.current {
    background: var(--brand);
    border-color: var(--brand);
    color: var(--paper);
  }

  .pcg .callout {
    border: 1px solid var(--line-strong);
    border-left: 4px solid var(--brand);
    border-radius: 8px;
    padding: 20px 22px;
    margin: 0 0 28px;
    background: var(--paper-raised);
  }
  .pcg .callout.warn { border-left-color: var(--warn); }
  .pcg .callout h3 {
    font-family: var(--font-ui);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    margin: 0 0 10px;
    color: var(--ink);
  }
  .pcg .callout.warn h3 { color: var(--warn); }
  .pcg .callout p { margin: 0 0 10px; font-size: 0.96rem; color: var(--ink-soft); }
  .pcg .callout p:last-child { margin-bottom: 0; }
  .pcg .callout ul { margin: 8px 0 0; padding-left: 20px; }
  .pcg .callout li { margin-bottom: 5px; font-size: 0.94rem; color: var(--ink-soft); }
  .pcg .callout strong { color: var(--ink); }

  .pcg .flags {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
    margin-top: 12px;
  }
  .pcg .flag {
    font-family: var(--font-ui);
    font-size: 0.84rem;
    background: var(--warn-tint);
    color: var(--ink);
    border-radius: 6px;
    padding: 8px 12px;
  }

  .pcg section.block { margin-bottom: 44px; }
  .pcg .block-title {
    font-family: var(--font-display);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    font-size: 1.1rem;
    color: var(--ink);
    margin: 0 0 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--ink);
    display: inline-block;
  }

  .pcg .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    font-family: var(--font-ui);
    font-size: 0.82rem;
    color: var(--ink-soft);
    margin-bottom: 20px;
  }
  .pcg .legend .dot {
    display: inline-block;
    width: 9px; height: 9px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
  }

  .pcg .refgrid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
  }
  .pcg .refcard {
    background: var(--paper-raised);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 18px 20px;
  }
  .pcg .refcard h4 {
    font-family: var(--font-ui);
    font-size: 0.86rem;
    font-weight: 700;
    margin: 0 0 8px;
    color: var(--ink);
  }
  .pcg .refcard ul { margin: 0; padding-left: 18px; }
  .pcg .refcard li { font-size: 0.88rem; color: var(--ink-soft); margin-bottom: 5px; }

  .pcg table.progression {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-ui);
    font-size: 0.86rem;
  }
  .pcg table.progression th, .pcg table.progression td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
  }
  .pcg table.progression th {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
    font-weight: 700;
  }
  .pcg table.progression td.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

  .pcg .week {
    scroll-margin-top: 70px;
    margin-bottom: 40px;
  }
  .pcg .week-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 20px;
    margin-bottom: 6px;
  }
  .pcg .week-head h2 {
    font-family: var(--font-display);
    font-weight: 800;
    text-transform: uppercase;
    font-size: 1.3rem;
    letter-spacing: 0.01em;
    margin: 0;
    color: var(--ink);
  }
  .pcg .week-head .dates {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 0.82rem;
    color: var(--ink-faint);
  }
  .pcg .week-theme {
    font-family: var(--font-body);
    font-style: italic;
    color: var(--brand-ink, var(--brand));
    font-size: 0.98rem;
    margin: 2px 0 16px;
  }
  .pcg .current-badge {
    font-family: var(--font-ui);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: var(--brand);
    color: var(--paper);
    padding: 3px 9px;
    border-radius: 999px;
  }

  .pcg .tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
  .pcg table.plan {
    width: 100%;
    border-collapse: collapse;
    background: var(--paper-raised);
    min-width: 640px;
  }
  .pcg table.plan th {
    text-align: left;
    font-family: var(--font-ui);
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--ink-faint);
    font-weight: 700;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line-strong);
    background: var(--paper-sunken);
  }
  .pcg table.plan td {
    padding: 12px 14px;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
    font-size: 0.92rem;
  }
  .pcg table.plan tr:last-child td { border-bottom: none; }
  .pcg table.plan td.day {
    font-family: var(--font-ui);
    font-weight: 700;
    white-space: nowrap;
    color: var(--ink);
  }
  .pcg table.plan td.day .d {
    display: block;
    font-family: var(--font-mono);
    font-weight: 400;
    font-size: 0.76rem;
    color: var(--ink-faint);
    margin-top: 2px;
  }
  .pcg table.plan td.detail { color: var(--ink-soft); }
  .pcg table.plan td.detail .note {
    display: block;
    margin-top: 5px;
    font-size: 0.84rem;
    font-style: italic;
    color: var(--ink-faint);
  }
  .pcg table.plan td.detail .fuel {
    display: inline-block;
    margin-top: 6px;
    font-family: var(--font-ui);
    font-size: 0.78rem;
    background: var(--warn-tint);
    color: var(--ink);
    padding: 3px 9px;
    border-radius: 5px;
  }

  .pcg .chip {
    display: inline-block;
    font-family: var(--font-ui);
    font-weight: 700;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 4px 9px;
    border-radius: 5px;
    white-space: nowrap;
  }
  .pcg .chip.swim { background: var(--swim-tint); color: var(--swim); }
  .pcg .chip.bike { background: var(--bike-tint); color: var(--bike); }
  .pcg .chip.run { background: var(--run-tint); color: var(--run); }
  .pcg .chip.strength { background: var(--strength-tint); color: var(--strength); }
  .pcg .chip.rest { background: var(--rest-tint); color: var(--ink-faint); }
  .pcg .chip.brick { background: var(--brick-tint); color: var(--brick); }
  .pcg .chip.race { background: var(--warn); color: var(--paper); }

  .pcg .foot {
    margin-top: 56px;
    padding-top: 24px;
    border-top: 1px solid var(--line);
    font-family: var(--font-ui);
    font-size: 0.84rem;
    color: var(--ink-faint);
  }

  @media (max-width: 640px) {
    .pcg .masthead { padding-top: 32px; }
    .pcg .week-head { flex-direction: column; align-items: flex-start; }
  }
`;

export default function PlanoCarangueman() {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'pcg-styles';
    style.textContent = HTML_STYLE;
    document.head.appendChild(style);

    // highlight current week
    const root = document.getElementById('pcg-root');
    if (root) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weeks = root.querySelectorAll<HTMLElement>('.week');
      const navLinks = root.querySelectorAll<HTMLElement>('#weeknav a');
      let matched: HTMLElement | null = null;
      weeks.forEach((w) => {
        const start = new Date(w.getAttribute('data-start') + 'T00:00:00');
        const end = new Date(w.getAttribute('data-end') + 'T23:59:59');
        if (today >= start && today <= end) {
          matched = w;
          const h2 = w.querySelector('.week-head h2');
          if (h2 && !h2.querySelector('.current-badge')) {
            const badge = document.createElement('span');
            badge.className = 'current-badge';
            badge.textContent = 'Semana atual';
            h2.appendChild(document.createTextNode(' '));
            h2.appendChild(badge);
          }
        }
      });
      if (matched && navLinks.length) {
        const idx = Array.prototype.indexOf.call(weeks, matched);
        if (navLinks[idx]) navLinks[idx].classList.add('current');
      }
    }

    return () => {
      document.getElementById('pcg-styles')?.remove();
    };
  }, []);

  return (
    <div style={{ margin: 0 }}>
      <div
        className="pcg"
        id="pcg-root"
        dangerouslySetInnerHTML={{
          __html: `
  <div class="wrap">

    <header class="masthead">
      <p class="eyebrow">Plano de treino &middot; 7 semanas</p>
      <h1>Carangueman Super&nbsp;Sprint</h1>
      <p class="subhead">Carlos Eduardo &mdash; Aracaju/SE, 06 de setembro de 2026. Natação em águas abertas na foz do Vaza-Barris, ciclismo em bike speed, corrida de 2,5&nbsp;km. Construído em cima da base já treinada desde julho, com o joelho esquerdo como prioridade nº1 de decisão em toda semana.</p>

      <div class="vitals">
        <div class="vital"><p class="k">Prova</p><p class="v">06/09 <small>domingo</small></p></div>
        <div class="vital"><p class="k">Natação</p><p class="v">400m <small>corte 30min &middot; meta 10&ndash;14min</small></p></div>
        <div class="vital"><p class="k">Bike</p><p class="v">20km <small>corte 1h &middot; speed</small></p></div>
        <div class="vital"><p class="k">Corrida</p><p class="v">2,5km <small>corte 30min</small></p></div>
        <div class="vital"><p class="k">Tempo total</p><p class="v">&lt;2h <small>corte oficial</small></p></div>
      </div>
    </header>

    <nav class="weeknav" id="weeknav">
      <a href="#semana1">S1 &middot; 19&ndash;25/07</a>
      <a href="#semana2">S2 &middot; 26/07&ndash;01/08</a>
      <a href="#semana3">S3 &middot; 03&ndash;09/08</a>
      <a href="#semana4">S4 &middot; 10&ndash;16/08</a>
      <a href="#semana5">S5 &middot; 17&ndash;23/08</a>
      <a href="#semana6">S6 &middot; 24&ndash;30/08</a>
      <a href="#semana7">S7 &middot; 31/08&ndash;06/09</a>
    </nav>

    <div class="callout warn">
      <h3>Regra que manda em tudo: o joelho decide, não a planilha</h3>
      <p>Esquerdo é o problema conhecido (chegou a 5&ndash;6/10 em 13/07); direito é sinal novo, mais leve (3&ndash;4/10), ambos posicionais, sem inchaço. Duas semanas de repouso parcial não zeraram o esquerdo sozinhas &mdash; por isso essa planilha entra com volume reduzido e reintrodução gradual, não com progressão linear normal.</p>
      <p><strong>Checkpoint fixo: início da Semana 3 (03/08)</strong> &mdash; 3&ndash;4 semanas desde o pico de dor. Só a partir daí a corrida e a bike progridem de verdade. Se antes disso qualquer sessão reproduzir dor, ela é substituída por musculação/mobilidade, sem exceção.</p>
      <div class="flags">
        <div class="flag">🚩 Inchaço visível surgindo</div>
        <div class="flag">🚩 Travamento (não estende/flexiona completo)</div>
        <div class="flag">🚩 Joelho "falseando"</div>
        <div class="flag">🚩 Dor piorando apesar do descanso</div>
        <div class="flag">🚩 Dor noturna</div>
      </div>
      <p style="margin-top:12px">Qualquer um desses &rarr; para o treino do dia e busca avaliação presencial (UBS/SUS ou clínica-escola de fisioterapia), independente do que está escrito abaixo.</p>
    </div>

    <section class="block">
      <h2 class="block-title">Como ler a planilha</h2>
      <div class="legend">
        <span><span class="dot" style="background:var(--swim)"></span>Natação</span>
        <span><span class="dot" style="background:var(--bike)"></span>Bike</span>
        <span><span class="dot" style="background:var(--run)"></span>Corrida</span>
        <span><span class="dot" style="background:var(--brick)"></span>Transição/Brick</span>
        <span><span class="dot" style="background:var(--strength)"></span>Musculação</span>
        <span><span class="dot" style="background:var(--warn)"></span>Simulado/Prova</span>
        <span><span class="dot" style="background:var(--ink-faint)"></span>Descanso</span>
      </div>

      <div class="refgrid">
        <div class="refcard">
          <h4>Musculação &mdash; protocolo padrão (repete 2&ndash;3x/semana)</h4>
          <ul>
            <li>Extensão terminal de joelho c/ elástico &mdash; 3x15</li>
            <li>Ponte de glúteo unilateral &mdash; 3x12 cada lado</li>
            <li>Passada lateral c/ elástico + ostra &mdash; 3x15</li>
            <li>Wall sit (progride a duração semana a semana)</li>
            <li>Equilíbrio unipodal &mdash; 3x30s cada lado</li>
            <li>Mobilidade de quadril e tornozelo &mdash; fechamento</li>
            <li>Leg press amplitude parcial (a partir da S3, se disponível)</li>
          </ul>
        </div>
        <div class="refcard">
          <h4>Aquecimento / volta à calma (corrida)</h4>
          <ul>
            <li>Antes: caminhada 3min + leg swings + círculos de tornozelo + mini-agachamento</li>
            <li>Depois: caminhada 3min + alongamento quadríceps/isquio/panturrilha, 30s cada</li>
            <li>Cadência de passada alta (170&ndash;180/min), terreno plano</li>
          </ul>
        </div>
        <div class="refcard">
          <h4>Regra da bike</h4>
          <ul>
            <li>Cadência 90+ rpm, marcha sempre leve (teste de fala)</li>
            <li>Selim na altura de extensão quase completa &mdash; intocável</li>
            <li>Progressão por tempo, nunca por km fixado antes de sair</li>
          </ul>
        </div>
        <div class="refcard">
          <h4>Natação &mdash; lógica da progressão</h4>
          <ul>
            <li>Volume trava em 500&ndash;800m/sessão &mdash; não sobe mais que isso</li>
            <li>O que evolui é o <strong>descanso</strong>: de 45&ndash;60s para 20s entre tiros</li>
            <li>Sem pernada forte enquanto o joelho estiver em observação (usa pull buoy)</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="block">
      <h2 class="block-title">Progressão da natação, semana a semana</h2>
      <div class="tablewrap">
        <table class="progression">
          <thead><tr><th>Semana</th><th>Estrutura</th><th>Descanso</th><th>Volume aprox.</th></tr></thead>
          <tbody>
            <tr><td>S1</td><td class="mono">8&ndash;10 x 50m</td><td class="mono">45&ndash;60s</td><td class="mono">500&ndash;600m</td></tr>
            <tr><td>S2</td><td class="mono">8 x 50m</td><td class="mono">35&ndash;40s</td><td class="mono">500&ndash;600m</td></tr>
            <tr><td>S3</td><td class="mono">6 x 75m</td><td class="mono">25&ndash;30s</td><td class="mono">550&ndash;650m</td></tr>
            <tr><td>S4</td><td class="mono">6 x 100m</td><td class="mono">20&ndash;25s</td><td class="mono">700&ndash;800m</td></tr>
            <tr><td>S5</td><td class="mono">6&ndash;8 x 100m</td><td class="mono">20s</td><td class="mono">700&ndash;800m</td></tr>
            <tr><td>S6</td><td class="mono">4 x 100m ritmo prova + simulado 400m</td><td class="mono">20s</td><td class="mono">~800m</td></tr>
            <tr><td>S7</td><td class="mono">técnica livre, sem sets</td><td class="mono">&mdash;</td><td class="mono">300&ndash;400m</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="week" id="semana1" data-start="2026-07-19" data-end="2026-07-25">
      <div class="week-head">
        <h2>Semana 1</h2>
        <span class="dates">19/07 &ndash; 25/07 &middot; Aracaju</span>
      </div>
      <p class="week-theme">Consolidação e cautela &mdash; sem piscina disponível até sábado (só a sessão de águas abertas no dia 25), então a semana ganha mais caminhada/corrida leve no lugar. Joelho melhorou: retoma trote com liberdade, mas para no primeiro sinal de dor.</p>
      <div class="tablewrap">
        <table class="plan">
          <thead><tr><th>Dia</th><th>Sessão</th><th>Detalhes</th></tr></thead>
          <tbody>
            <tr><td class="day">Dom<span class="d">19/07</span></td><td><span class="chip rest">Descanso</span></td><td class="detail">Descanso total. Início oficial do bloco.</td></tr>
            <tr><td class="day">Seg<span class="d">20/07</span></td><td><span class="chip strength">Musculação</span></td><td class="detail">Protocolo padrão (ver referência acima). Sem carga pesada de perna ainda &mdash; foco em ativação e controle.</td></tr>
            <tr><td class="day">Ter<span class="d">21/07</span></td><td><span class="chip run">Caminhada longa</span></td><td class="detail">Sem piscina disponível no interior &mdash; substitui a natação por caminhada mais longa, 30&ndash;40min, ritmo tranquilo, sem trote.</td></tr>
            <tr><td class="day">Qua<span class="d">22/07</span></td><td><span class="chip run">Corrida</span></td><td class="detail">Caminhada + trote leve, ~22&ndash;25min (nível de 17/07). <span class="note">Joelho melhor &mdash; segue com liberdade, mas para na hora se doer.</span></td></tr>
            <tr><td class="day">Qui<span class="d">23/07</span></td><td><span class="chip strength">Musculação</span></td><td class="detail">2ª sessão da semana + mobilidade extra de quadril/tornozelo.</td></tr>
            <tr><td class="day">Sex<span class="d">24/07</span></td><td><span class="chip bike">Bike</span></td><td class="detail">Única pedalada da semana (MTB). 25&ndash;30min bem leve, cadência alta. Cancela se sentir qualquer coisa nos joelhos.</td></tr>
            <tr><td class="day">Sáb<span class="d">25/07</span></td><td><span class="chip swim">Natação &middot; Águas abertas</span></td><td class="detail">🌊 Única sessão de natação da semana (exceção pontual por falta de piscina &mdash; volta a 2x/semana já na Semana 2). Primeira vez em águas abertas, foz do Vaza-Barris. 20&ndash;30min, foco em sighting e conforto, sem cronômetro. Leva companhia + bóia de sinalização.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="week" id="semana2" data-start="2026-07-26" data-end="2026-08-01">
      <div class="week-head">
        <h2>Semana 2</h2>
        <span class="dates">26/07 &ndash; 01/08 &middot; Transição Aracaju &rarr; Feira de Santana</span>
      </div>
      <p class="week-theme">Volta à rotina de aulas + estreia da bike speed. Retoma corrida com cautela, sem acelerar antes do checkpoint.</p>
      <div class="tablewrap">
        <table class="plan">
          <thead><tr><th>Dia</th><th>Sessão</th><th>Detalhes</th></tr></thead>
          <tbody>
            <tr><td class="day">Dom<span class="d">26/07</span></td><td><span class="chip rest">Descanso</span></td><td class="detail">Último dia em Aracaju. Caminhada leve na praia, opcional.</td></tr>
            <tr><td class="day">Seg<span class="d">27/07</span></td><td><span class="chip bike">Ajuste de bike</span></td><td class="detail">Viagem pra Feira de Santana. Bike speed nova: ajusta só selim (extensão quase completa, mesma regra de sempre) e freios. Não pedala hoje.</td></tr>
            <tr><td class="day">Ter<span class="d">28/07</span></td><td><span class="chip swim">Natação 1</span> <span class="chip bike">+ teste bike</span></td><td class="detail">12h, UEFS: 8 x 50m / 35&ndash;40s. Manhã: habilidades clínicas. Tarde: primeira saída na bike nova &mdash; só 15&ndash;20min de adaptação de posição e freio, sem cobrar ritmo.</td></tr>
            <tr><td class="day">Qua<span class="d">29/07</span></td><td><span class="chip strength">Musculação</span></td><td class="detail">Manhã: saúde coletiva. Tarde: protocolo padrão, wall sit progride +5&ndash;10s sobre a semana passada.</td></tr>
            <tr><td class="day">Qui<span class="d">30/07</span></td><td><span class="chip run">Corrida</span></td><td class="detail">Manhã: tutoria. Tarde: retoma progressão, só se 100% sem sintoma nas 2 semanas anteriores &mdash; 5 x [2min trote / 2min caminhada] (~20min).</td></tr>
            <tr><td class="day">Sex<span class="d">31/07</span></td><td><span class="chip swim">Natação 2</span></td><td class="detail">Manhã: aulas do módulo. Tarde: 8 x 50m / 35s descanso.</td></tr>
            <tr><td class="day">Sáb<span class="d">01/08</span></td><td><span class="chip bike">Bike</span></td><td class="detail">Primeira saída de verdade na speed: 30&ndash;40min, ainda leve. Sente a diferença de eficiência em relação à MTB.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="week" id="semana3" data-start="2026-08-03" data-end="2026-08-09">
      <div class="week-head">
        <h2>Semana 3</h2>
        <span class="dates">03/08 &ndash; 09/08 &middot; Feira de Santana</span>
      </div>
      <p class="week-theme">🔎 Checkpoint das 3&ndash;4 semanas. Se o joelho estiver estável, começam as transições e a progressão sai do modo cauteloso.</p>
      <div class="tablewrap">
        <table class="plan">
          <thead><tr><th>Dia</th><th>Sessão</th><th>Detalhes</th></tr></thead>
          <tbody>
            <tr><td class="day">Seg<span class="d">03/08</span></td><td><span class="chip strength">Musculação</span></td><td class="detail">Protocolo padrão, adiciona leg press amplitude parcial se tiver acesso.</td></tr>
            <tr><td class="day">Ter<span class="d">04/08</span></td><td><span class="chip swim">Natação</span> <span class="chip brick">Brick T1</span></td><td class="detail">12h UEFS: 6 x 75m / 25&ndash;30s. Logo em seguida: bike leve 15&ndash;20min no campus (sai da água direto pro pedal &mdash; primeiro contato com a sensação de "pernas de gelatina" pós-nado).</td></tr>
            <tr><td class="day">Qua<span class="d">05/08</span></td><td><span class="chip bike">Bike</span></td><td class="detail">Sessão principal: 40&ndash;50min, construção de volume na speed.</td></tr>
            <tr><td class="day">Qui<span class="d">06/08</span></td><td><span class="chip run">Corrida</span></td><td class="detail">6 x [3min trote / 2min caminhada] (~30min). Pode usar a assessoria da tarde se quiser.</td></tr>
            <tr><td class="day">Sex<span class="d">07/08</span></td><td><span class="chip swim">Natação</span></td><td class="detail">6 x 75m / 25s descanso.</td></tr>
            <tr><td class="day">Sáb<span class="d">08/08</span></td><td><span class="chip bike">Bike longa</span></td><td class="detail">50&ndash;60min &mdash; primeira aproximação real do volume da prova (20km a ~20km/h cabe nesse tempo).</td></tr>
            <tr><td class="day">Dom<span class="d">09/08</span></td><td><span class="chip rest">Descanso ativo</span></td><td class="detail">Mobilidade, ou musculação leve extra se estiver tudo bem.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="week" id="semana4" data-start="2026-08-10" data-end="2026-08-16">
      <div class="week-head">
        <h2>Semana 4</h2>
        <span class="dates">10/08 &ndash; 16/08</span>
      </div>
      <p class="week-theme">Construção &mdash; primeiro brick longo unindo bike e corrida na sequência real da prova.</p>
      <div class="tablewrap">
        <table class="plan">
          <thead><tr><th>Dia</th><th>Sessão</th><th>Detalhes</th></tr></thead>
          <tbody>
            <tr><td class="day">Seg<span class="d">10/08</span></td><td><span class="chip strength">Musculação</span></td><td class="detail">Protocolo padrão, progride carga do leg press se disponível.</td></tr>
            <tr><td class="day">Ter<span class="d">11/08</span></td><td><span class="chip swim">Natação</span> <span class="chip brick">Brick T1</span></td><td class="detail">6 x 100m / 20&ndash;25s. + bike leve pós-nado, 20&ndash;25min.</td></tr>
            <tr><td class="day">Qua<span class="d">12/08</span></td><td><span class="chip bike">Bike</span></td><td class="detail">50min, ritmo de base.</td></tr>
            <tr><td class="day">Qui<span class="d">13/08</span></td><td><span class="chip run">Corrida</span></td><td class="detail">8 x [4min trote / 1min caminhada] (~40min) &mdash; ou já tenta blocos contínuos de 10&ndash;15min se estiver confortável.</td></tr>
            <tr><td class="day">Sex<span class="d">14/08</span></td><td><span class="chip swim">Natação</span></td><td class="detail">6 x 100m / 20s descanso &mdash; bate a estrutura-alvo (6x100/20s).</td></tr>
            <tr><td class="day">Sáb<span class="d">15/08</span></td><td><span class="chip brick">Brick longo</span></td><td class="detail">Bike 60min (~20km ritmo) + corrida imediata 10&ndash;15min (treino de T2). <span class="fuel">🥤 Treino do estômago: gel de carboidrato fracionado + 2&ndash;3 goles de água durante a bike</span></td></tr>
            <tr><td class="day">Dom<span class="d">16/08</span></td><td><span class="chip rest">Descanso</span></td><td class="detail">Total, pós-brick.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="week" id="semana5" data-start="2026-08-17" data-end="2026-08-23">
      <div class="week-head">
        <h2>Semana 5</h2>
        <span class="dates">17/08 &ndash; 23/08</span>
      </div>
      <p class="week-theme">Pico de volume &mdash; primeira vez correndo os 2,5km contínuos e mini-simulado bike+corrida.</p>
      <div class="tablewrap">
        <table class="plan">
          <thead><tr><th>Dia</th><th>Sessão</th><th>Detalhes</th></tr></thead>
          <tbody>
            <tr><td class="day">Seg<span class="d">17/08</span></td><td><span class="chip strength">Musculação</span></td><td class="detail">Protocolo padrão.</td></tr>
            <tr><td class="day">Ter<span class="d">18/08</span></td><td><span class="chip swim">Natação</span> <span class="chip brick">Brick T1</span></td><td class="detail">6&ndash;8 x 100m / 20s. + bike pós-nado, 25&ndash;30min.</td></tr>
            <tr><td class="day">Qua<span class="d">19/08</span></td><td><span class="chip bike">Bike</span></td><td class="detail">55&ndash;60min, ritmo moderado.</td></tr>
            <tr><td class="day">Qui<span class="d">20/08</span></td><td><span class="chip run">Corrida</span></td><td class="detail">Tenta os 2,5km sem parar pela primeira vez &mdash; ritmo confortável, sem pressa de pace.</td></tr>
            <tr><td class="day">Sex<span class="d">21/08</span></td><td><span class="chip swim">Natação &middot; ritmo de prova</span></td><td class="detail">4 x 100m no ritmo que pretende nadar na prova, descanso curto.</td></tr>
            <tr><td class="day">Sáb<span class="d">22/08</span></td><td><span class="chip brick">Mini-simulado</span></td><td class="detail">Bike 20km em ritmo de prova + corrida 2,5km (T2) na sequência, tudo cronometrado. <span class="fuel">🥤 Treino do estômago obrigatório</span></td></tr>
            <tr><td class="day">Dom<span class="d">23/08</span></td><td><span class="chip rest">Descanso total</span></td><td class="detail">Pós-esforço grande da semana.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="week" id="semana6" data-start="2026-08-24" data-end="2026-08-30">
      <div class="week-head">
        <h2>Semana 6</h2>
        <span class="dates">24/08 &ndash; 30/08</span>
      </div>
      <p class="week-theme">Simulado completo + início do polimento. Última chance de ensaiar a estratégia inteira antes da prova.</p>
      <div class="tablewrap">
        <table class="plan">
          <thead><tr><th>Dia</th><th>Sessão</th><th>Detalhes</th></tr></thead>
          <tbody>
            <tr><td class="day">Seg<span class="d">24/08</span></td><td><span class="chip strength">Musculação leve</span></td><td class="detail">Reduz carga, mantém mobilidade.</td></tr>
            <tr><td class="day">Ter<span class="d">25/08</span></td><td><span class="chip swim">Natação</span> <span class="chip brick">Brick curto</span></td><td class="detail">4 x 100m ritmo de prova + bike curta pós-nado.</td></tr>
            <tr><td class="day">Qua<span class="d">26/08</span></td><td><span class="chip bike">Bike</span></td><td class="detail">40min, moderada.</td></tr>
            <tr><td class="day">Qui<span class="d">27/08</span></td><td><span class="chip run">Corrida leve</span></td><td class="detail">20min, ritmo fácil.</td></tr>
            <tr><td class="day">Sex<span class="d">28/08</span></td><td><span class="chip rest">Descanso</span></td><td class="detail">Total, antes do simulado.</td></tr>
            <tr><td class="day">Sáb<span class="d">29/08</span></td><td><span class="chip race">Simulado completo</span></td><td class="detail">🏁 Natação 400m em piscina (proxy &mdash; sem acesso a águas abertas em Feira de Santana) + T1 + Bike 20km ritmo de prova + T2 + Corrida 2,5km ritmo de prova. Cronometra tudo, testa a estratégia de nutrição do início ao fim. <span class="fuel">🥤 Treino do estômago completo</span></td></tr>
            <tr><td class="day">Dom<span class="d">30/08</span></td><td><span class="chip rest">Descanso total</span></td><td class="detail">Avalia o simulado: o que ajustar antes da prova (pacing, nutrição, posição na bike).</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="week" id="semana7" data-start="2026-08-31" data-end="2026-09-06">
      <div class="week-head">
        <h2>Semana 7 &middot; Polimento</h2>
        <span class="dates">31/08 &ndash; 06/09</span>
      </div>
      <p class="week-theme">Redução drástica de volume, recuperação e foco mental. Chegar descansado importa mais que treinar forte agora.</p>
      <div class="tablewrap">
        <table class="plan">
          <thead><tr><th>Dia</th><th>Sessão</th><th>Detalhes</th></tr></thead>
          <tbody>
            <tr><td class="day">Seg<span class="d">31/08</span></td><td><span class="chip strength">Mobilidade</span></td><td class="detail">Só ativação leve, sem carga pesada.</td></tr>
            <tr><td class="day">Ter<span class="d">01/09</span></td><td><span class="chip swim">Natação leve</span></td><td class="detail">300&ndash;400m técnica, sem intensidade.</td></tr>
            <tr><td class="day">Qua<span class="d">02/09</span></td><td><span class="chip bike">Bike curta</span></td><td class="detail">20min, só pra manter sensação nas pernas.</td></tr>
            <tr><td class="day">Qui<span class="d">03/09</span></td><td><span class="chip run">Corrida curta</span></td><td class="detail">10&ndash;15min bem leve.</td></tr>
            <tr><td class="day">Sex<span class="d">04/09</span></td><td><span class="chip rest">Descanso total</span></td><td class="detail">Zero treino.</td></tr>
            <tr><td class="day">Sáb<span class="d">05/09</span></td><td><span class="chip rest">Ativação mínima</span></td><td class="detail">10min bike + 5min trote leve. Organiza material, reconhece o local da prova se possível (saída da água, T1, T2).</td></tr>
            <tr><td class="day">Dom<span class="d">06/09</span></td><td><span class="chip race">🏁 PROVA</span></td><td class="detail">Carangueman Super Sprint. Natação sem pressa &middot; bike cadência alta, marcha leve &middot; corrida no ritmo que o corpo pedir. Meta: terminar bem, dentro do corte de 2h.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="foot">
      Plano vivo: qualquer sinal do joelho (esquerdo ou direito) reescreve a semana, não o contrário. Atualiza os treinos comigo a cada sessão relevante.
    </div>

  </div>
`,
        }}
      />
    </div>
  );
}
