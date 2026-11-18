import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { DEMO_PAGE_STYLES } from './demo.styles';
import { DemoStore } from './demo.store';

interface Kpi {
  id: string;
  icon: string;
  label: string;
  value: string;
  note: string;
  tone: string;
  text: string;
  rows: { label: string; value: string }[];
  link?: { label: string; route: string; query?: Record<string, string | number> };
}

interface Insight { icon: string; text: string; tone: 'good' | 'warn' | 'info' }

// Colores de los gráficos (los mismos del tablero real).
const TEAL = '#1AB7AF';
const AMBER = '#F59E0B';
const CATEGORY_COLORS = ['#1AB7AF', '#1385B6', '#6AC64A', '#8B5CF6', '#F59E0B', '#e5675d', '#94a3b8', '#64748b'];
const AGING_COLORS = ['#fbbf24', '#f59e0b', '#cf4b3f'];

// Misión 1: el panel del edificio. Cada indicador se puede abrir para ver de dónde sale la cifra.
@Component({
  standalone: true,
  selector: 'app-demo-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, ChartModule],
  template: `
    <div class="hero">
      <span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span>
      <div class="hero-main">
        <p class="eyebrow">{{ t().panel.eyebrow }}</p>
        <h1>{{ t().panel.title }}</h1>
        <p class="sub">{{ t().panel.sub }}</p>
        <div class="hero-actions">
          <a routerLink="/explorar/unidades" class="chip-link"><i class="pi pi-th-large"></i> {{ t().shell.nav.units }}</a>
          <a routerLink="/explorar/gastos" class="chip-link"><i class="pi pi-wallet"></i> {{ t().shell.nav.expenses }}</a>
          <a routerLink="/explorar/informes" class="chip-link"><i class="pi pi-file"></i> {{ t().shell.nav.reports }}</a>
        </div>
      </div>

      <div class="hero-ring">
        <svg viewBox="0 0 120 120">
          <defs>
            <linearGradient id="heroRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="100%" stop-color="#c8f5a5"/>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="50" class="trk"/>
          <circle cx="60" cy="60" r="50" class="fil" [style.stroke-dashoffset]="ringOffset(rate())"/>
        </svg>
        <div class="ring-c"><strong>{{ rate() }}%</strong><span>{{ t().panel.ringLabel }}</span></div>
      </div>
    </div>

    <div class="kpis">
      @for (k of kpis(); track k.id) {
        <button type="button" class="kpi" [class.sel]="selectedId() === k.id" [ngClass]="'t-' + k.tone" (click)="select(k.id)">
          <div class="k-ico"><i [class]="'pi ' + k.icon"></i></div>
          <span class="k-lbl">{{ k.label }}</span>
          <strong class="k-val">{{ k.value }}</strong>
          <small class="k-note">{{ k.note }}</small>
        </button>
      }
    </div>

    @if (selected(); as s) {
      <div class="card explain">
        <h2><i class="pi pi-search"></i> {{ t().panel.whereFrom(s.label) }}</h2>
        <p class="muted">{{ s.text }}</p>
        <ul>
          @for (r of s.rows; track r.label) {
            <li><span>{{ r.label }}</span><b>{{ r.value }}</b></li>
          }
        </ul>
        @if (s.link) {
          <a [routerLink]="s.link.route" [queryParams]="s.link.query" class="btn line">{{ s.link.label }} →</a>
        }
      </div>
    }

    <div class="insights">
      @for (i of insights(); track i.text) {
        <div class="insight" [ngClass]="'i-' + i.tone"><i class="pi" [ngClass]="i.icon"></i><span>{{ i.text }}</span></div>
      }
    </div>

    <div class="grid g-main">
      <div class="card">
        <div class="c-head"><div><h3>{{ t().panel.chartTitle }}</h3></div></div>
        <p-chart type="bar" [data]="monthlyData()" [options]="monthlyOptions" height="290px"></p-chart>
      </div>

      <div class="card">
        <div class="c-head"><div><h3>{{ t().panel.mixTitle }}</h3><p>{{ t().panel.mixSub }}</p></div></div>
        <div class="mix">
          <div class="mix-ring">
            <p-chart type="doughnut" [data]="mixData()" [options]="donutOptions" width="170px" height="170px"></p-chart>
            <div class="mix-c"><strong>{{ gs(store.expensesTotal()) }}</strong><span>{{ t().panel.mixCenter }}</span></div>
          </div>
          <div class="legend">
            @for (c of store.expensesByCategory(); track c.category; let i = $index) {
              <div>
                <i class="dot" [style.background]="categoryColor(i)"></i>
                <span class="ln">{{ c.label }}</span>
                <em>{{ t().percent(c.share) }}</em>
              </div>
            }
          </div>
        </div>
      </div>
    </div>

    <div class="grid g-two">
      <div class="card">
        <div class="c-head">
          <div><h3>{{ t().panel.agingTitle }}</h3><p>{{ t().panel.agingSub(store.overdueUnits.length, gs(store.overdueTotal)) }}</p></div>
          <a routerLink="/explorar/unidades" [queryParams]="{ deuda: 1 }" class="more">{{ t().panel.alertLink }}</a>
        </div>
        <div class="aging">
          @for (a of aging(); track a.label) {
            <div class="ag-row">
              <div class="ag-top"><span>{{ a.label }}</span><strong>{{ gs(a.amount) }}</strong></div>
              <div class="ag-track"><div class="ag-fill" [style.width.%]="a.share" [style.background]="a.color"></div></div>
              <small>{{ a.units }} {{ t().panel.unit(a.units) }}</small>
            </div>
          }
        </div>
      </div>

      <div class="card">
        <div class="c-head"><div><h3>{{ t().panel.debtorsTitle }}</h3><p>{{ t().panel.debtorsSub }}</p></div></div>
        @if (!topDebtors().length) {
          <p class="empty"><i class="pi pi-check-circle"></i> {{ t().panel.noDebt }}</p>
        } @else {
          <div class="debtors">
            @for (d of topDebtors(); track d.unit.code; let i = $index) {
              <div class="debtor">
                <span class="rank">{{ i + 1 }}</span>
                <div class="d-main"><strong>{{ d.unit.code }}</strong><small>{{ d.unit.owner }}</small></div>
                <span class="d-amt">{{ gs(d.amount) }}</span>
              </div>
            }
          </div>
        }
      </div>
    </div>

    <div class="card">
      <div class="c-head"><div><h3>{{ t().panel.lastMovements }}</h3></div></div>
      <ul class="mov">
        @for (m of store.lastMovements(); track m.id) {
          <li>
            <span class="d">{{ store.dateLabel(m.date) }}</span>
            <span class="t">{{ m.text }}</span>
            <b [class.pos]="m.income" [class.neg]="!m.income">{{ m.income ? '+' : '−' }} {{ gs(m.amount) }}</b>
          </li>
        }
      </ul>
      <a [routerLink]="store.ledgerRoute()" class="muted-link">{{ t().panel.seeAll }}</a>
    </div>

    <div class="card alert">
      <i class="pi pi-exclamation-triangle"></i>
      <span><b>{{ alert().bold }}</b>{{ alert().rest }}</span>
      <a routerLink="/explorar/unidades" [queryParams]="{ deuda: 1 }">{{ t().panel.alertLink }}</a>
    </div>
  `,
  styles: [
    DEMO_PAGE_STYLES,
    `
    /* ── HERO ─────────────────────────────────────────────────────── */
    .hero {
      position: relative; overflow: hidden; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
      background: linear-gradient(120deg, #1AB7AF 0%, #1385B6 55%, #6AC64A 120%);
      border-radius: 26px; padding: 1.8rem 2.2rem; margin-bottom: 1.3rem; color: #fff;
      box-shadow: 0 18px 44px rgba(19,133,182,0.28);
    }
    .orb { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.09); pointer-events: none; }
    .o1 { width: 340px; height: 340px; top: -120px; right: -60px; }
    .o2 { width: 190px; height: 190px; bottom: -70px; right: 230px; background: rgba(255,255,255,0.06); }
    .o3 { width: 110px; height: 110px; top: 24px; right: 440px; background: rgba(255,255,255,0.07); }
    .hero-main { position: relative; z-index: 1; min-width: 0; }
    .eyebrow { margin: 0 0 0.35rem; font-size: 0.74rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.75); }
    .hero h1 { margin: 0 0 0.35rem; font-size: 2.3rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; color: #fff; }
    .hero .sub { margin: 0 0 1.1rem; color: rgba(255,255,255,0.82); font-size: 0.95rem; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
    .chip-link { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.95rem; border-radius: 999px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.28); color: #fff; font-size: 0.8rem; font-weight: 700; text-decoration: none; transition: background .15s, transform .15s; }
    .chip-link:hover { background: rgba(255,255,255,0.28); transform: translateY(-1px); }

    .hero-ring { position: relative; z-index: 1; flex: 0 0 auto; width: 150px; height: 150px; }
    .hero-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .hero-ring .trk { fill: none; stroke: rgba(255,255,255,0.22); stroke-width: 10; }
    .hero-ring .fil { fill: none; stroke: url(#heroRing); stroke-width: 10; stroke-linecap: round; stroke-dasharray: 314.16; transition: stroke-dashoffset .9s cubic-bezier(.4,0,.2,1); }
    .ring-c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .ring-c strong { font-size: 2rem; font-weight: 800; line-height: 1; }
    .ring-c span { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.8); }

    /* ── KPIs de color ────────────────────────────────────────────── */
    .kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.9rem; margin-bottom: 1.1rem; }
    .kpi { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 0.2rem; padding: 1.1rem 1.1rem 1rem; border-radius: 20px; border: 0; font: inherit; cursor: pointer; color: #fff; box-shadow: 0 10px 26px rgba(17,54,74,0.14); transition: transform .18s, box-shadow .18s; }
    .kpi:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(17,54,74,0.2); }
    .kpi.sel { outline: 3px solid rgba(255,255,255,.7); outline-offset: -3px; }
    .kpi::after { content: ''; position: absolute; width: 110px; height: 110px; border-radius: 50%; background: rgba(255,255,255,0.12); right: -34px; bottom: -44px; }
    .t-teal   { background: linear-gradient(135deg, #1AB7AF, #129a93); }
    .t-blue   { background: linear-gradient(135deg, #1b9bd1, #1385B6 60%, #0f6e96); }
    .t-green  { background: linear-gradient(135deg, #7fd45f, #4da033); }
    .t-violet { background: linear-gradient(135deg, #a58bf8, #7c4ddb); }
    .t-amber  { background: linear-gradient(135deg, #fbbf24, #e08a06); }
    .t-coral  { background: linear-gradient(135deg, #f0857b, #cf4b3f); }
    .k-ico { width: 34px; height: 34px; border-radius: 11px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 0.45rem; font-size: 0.95rem; }
    .k-lbl { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.88; }
    .k-val { font-size: 1.55rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; }
    .k-note { font-size: 0.74rem; opacity: 0.85; position: relative; z-index: 1; }

    .explain { margin-bottom: 1.1rem; }
    .explain ul { list-style: none; margin: 0 0 0.8rem; padding: 0; }
    .explain li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; border-bottom: 1px dashed rgba(20,54,61,0.12); font-size: 0.9rem; }

    /* ── Lectura rápida ───────────────────────────────────────────── */
    .insights { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1.2rem; }
    .insight { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.55rem 0.95rem; border-radius: 999px; font-size: 0.84rem; font-weight: 600; border: 1px solid transparent; }
    .i-good { background: rgba(106,198,74,0.12); color: #2f7a1b; border-color: rgba(106,198,74,0.3); }
    .i-warn { background: rgba(245,158,11,0.12); color: #a96300; border-color: rgba(245,158,11,0.32); }
    .i-info { background: rgba(19,133,182,0.1); color: #0f6e96; border-color: rgba(19,133,182,0.25); }

    /* ── Tarjetas ─────────────────────────────────────────────────── */
    .grid { display: grid; gap: 1.1rem; margin-bottom: 1.1rem; }
    .g-main  { grid-template-columns: 1.7fr 1fr; }
    .g-two   { grid-template-columns: 1fr 1fr; }
    .c-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    .c-head h3 { margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--p-text-color); }
    .c-head p { margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--brand-muted); }
    .more { font-size: 0.8rem; font-weight: 700; color: var(--brand-blue, #1385B6); text-decoration: none; white-space: nowrap; }
    .more:hover { text-decoration: underline; }
    .empty { display: flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; color: #2f7a1b; font-weight: 600; font-size: 0.9rem; }

    /* ── Gastos por rubro ─────────────────────────────────────────── */
    .mix { display: flex; align-items: center; gap: 1.2rem; flex-wrap: wrap; justify-content: center; }
    .mix-ring { position: relative; width: 170px; height: 170px; flex: 0 0 auto; }
    .mix-c { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
    .mix-c strong { font-size: 1.15rem; font-weight: 800; color: var(--p-text-color); }
    .mix-c span { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--brand-muted); }
    .legend { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; min-width: 150px; }
    .legend > div { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }
    .ln { flex: 1; color: var(--p-text-color); }
    .legend em { font-style: normal; font-weight: 800; color: var(--p-text-color); }

    /* ── Antigüedad de la mora ────────────────────────────────────── */
    .aging { display: flex; flex-direction: column; gap: 0.9rem; }
    .ag-top { display: flex; justify-content: space-between; font-size: 0.86rem; margin-bottom: 0.3rem; }
    .ag-top span { font-weight: 600; color: var(--p-text-color); }
    .ag-track { height: 10px; border-radius: 999px; background: rgba(19,133,182,0.1); overflow: hidden; }
    .ag-fill { height: 100%; border-radius: 999px; min-width: 4px; transition: width .7s cubic-bezier(.4,0,.2,1); }
    .aging small { display: block; margin-top: 0.3rem; font-size: 0.76rem; color: var(--brand-muted); }

    /* ── Mayores deudores ─────────────────────────────────────────── */
    .debtors { display: flex; flex-direction: column; gap: 0.55rem; }
    .debtor { display: flex; align-items: center; gap: 0.8rem; padding: 0.6rem 0.8rem; border-radius: 14px; background: rgba(229,103,93,0.06); border: 1px solid rgba(229,103,93,0.14); }
    .rank { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #f0857b, #cf4b3f); color: #fff; font-weight: 800; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
    .d-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .d-main strong { font-size: 0.88rem; color: var(--p-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d-main small { font-size: 0.76rem; color: var(--brand-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d-amt { font-weight: 800; color: #cf4b3f; font-size: 0.92rem; white-space: nowrap; }

    .mov { list-style: none; margin: 0 0 0.6rem; padding: 0; }
    .mov li { display: grid; grid-template-columns: 4.6rem 1fr auto; gap: 0.5rem; padding: 0.45rem 0; border-bottom: 1px solid rgba(20,54,61,0.08); font-size: 0.84rem; }
    .mov .d { color: var(--brand-muted); }
    .mov .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .muted-link { font-size: 0.85rem; font-weight: 700; }
    .alert { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-top: 1.1rem; background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.32); }
    .alert i { color: #a96300; }

    /* ── Responsive ───────────────────────────────────────────────── */
    @media (max-width: 1280px) { .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 1000px) {
      .g-main, .g-two { grid-template-columns: 1fr; }
      .hero { flex-direction: column; align-items: flex-start; padding: 1.5rem; }
      .hero h1 { font-size: 1.8rem; }
    }
    @media (max-width: 560px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .k-val { font-size: 1.25rem; } }
    `
  ]
})
export class DemoPanelComponent {
  readonly store = inject(DemoStore);
  readonly t = this.store.t;
  readonly gs = (v: number): string => this.store.money(v);
  readonly alert = computed(() => this.t().panel.alert(this.store.overdueUnits.length, this.store.money(this.store.overdueTotal)));
  readonly selectedId = signal<string | null>(null);

  // Porcentaje cobrado del mes sobre lo emitido (anillo del encabezado).
  readonly rate = computed(() => {
    const s = this.store;
    return s.chargedMonth ? Math.round((s.collectedMonth / s.chargedMonth) * 100) : 0;
  });

  readonly kpis = computed<Kpi[]>(() => {
    const s = this.store;
    const tx = this.t();
    const k = tx.panel.kpi;
    const collected = s.collectedMonth;
    const expenses = s.expensesTotal();
    const rate = tx.percent(s.chargedMonth ? Math.round((collected / s.chargedMonth) * 100) : 0);
    const top = s.expensesByCategory().slice(0, 4).map((c) => ({ label: `${c.label} (${tx.percent(c.share)})`, value: s.money(c.amount) }));
    return [
      {
        id: 'cash', icon: 'pi-building-columns', label: k.cash.label, value: s.money(s.cashBalance()), note: k.cash.note, tone: 'teal',
        text: k.cash.text,
        rows: [{ label: k.cash.opening, value: s.money(s.openingCash) }, { label: k.cash.plus, value: s.money(collected) }, { label: k.cash.minus, value: s.money(expenses) }, { label: k.cash.equals, value: s.money(s.cashBalance()) }],
        link: { label: k.cash.link, route: s.ledgerRoute() }
      },
      {
        id: 'collected', icon: 'pi-money-bill', label: k.collected.label, value: s.money(collected), note: k.collected.note(rate), tone: 'blue',
        text: k.collected.text,
        rows: [{ label: k.collected.issued, value: s.money(s.chargedMonth) }, { label: k.collected.collectedWith(s.paymentsMonth.length), value: s.money(collected) }, { label: k.collected.rate, value: rate }],
        link: { label: k.collected.link, route: '/explorar/unidades' }
      },
      {
        id: 'expenses', icon: 'pi-wallet', label: k.expenses.label, value: s.money(expenses), note: k.expenses.note(s.expenses().length), tone: 'amber',
        text: k.expenses.text,
        rows: top,
        link: { label: k.expenses.link, route: '/explorar/gastos' }
      },
      {
        id: 'morosity', icon: 'pi-percentage', label: k.morosity.label, value: tx.percent(tx.decimal(s.morosityPct)), note: k.morosity.note(s.overdueUnits.length, s.units.length), tone: 'coral',
        text: k.morosity.text,
        rows: [{ label: k.morosity.withDebt, value: `${s.overdueUnits.length}` }, { label: k.morosity.totalUnits, value: `${s.units.length}` }, { label: k.morosity.totalDebt, value: s.money(s.overdueTotal) }],
        link: { label: k.morosity.link, route: '/explorar/unidades', query: { deuda: 1 } }
      },
      {
        id: 'pending', icon: 'pi-clock', label: k.pending.label, value: s.money(s.pendingTotal), note: k.pending.note, tone: 'violet',
        text: k.pending.text,
        rows: [{ label: k.pending.overdue, value: s.money(s.overdueTotal) }, { label: k.pending.upcoming, value: s.money(Math.max(s.pendingTotal - s.overdueTotal, 0)) }]
      },
      {
        id: 'reserve', icon: 'pi-shield', label: k.reserve.label, value: s.money(s.reserveFund), note: k.reserve.note, tone: 'green',
        text: k.reserve.text,
        rows: [{ label: k.reserve.balance, value: s.money(s.reserveFund) }]
      }
    ];
  });

  readonly selected = computed(() => this.kpis().find((k) => k.id === this.selectedId()) ?? null);

  readonly insights = computed<Insight[]>(() => {
    const s = this.store;
    const tx = this.t().panel.insights;
    const list: Insight[] = [
      this.rate() >= 80
        ? { icon: 'pi-thumbs-up', text: tx.collection(this.t().percent(this.rate())), tone: 'good' }
        : { icon: 'pi-flag', text: tx.collection(this.t().percent(this.rate())), tone: 'warn' }
    ];
    if (s.overdueUnits.length) list.push({ icon: 'pi-exclamation-circle', text: tx.overdue(s.overdueUnits.length, s.money(s.overdueTotal)), tone: 'warn' });
    list.push({ icon: 'pi-building-columns', text: tx.cash(s.money(s.cashBalance())), tone: 'info' });
    return list;
  });

  readonly monthlyData = computed(() => {
    const tx = this.t().panel;
    const chart = this.store.chart();
    return {
      labels: chart.map((c) => c.label),
      datasets: [
        { type: 'bar', label: tx.collectedTip, data: chart.map((c) => c.income), backgroundColor: TEAL, borderRadius: 6 },
        { type: 'bar', label: tx.expensesTip, data: chart.map((c) => c.expense), backgroundColor: AMBER, borderRadius: 6 }
      ]
    };
  });

  readonly mixData = computed(() => {
    const cats = this.store.expensesByCategory();
    return {
      labels: cats.map((c) => c.label),
      datasets: [{ data: cats.map((c) => c.amount), backgroundColor: cats.map((_, i) => this.categoryColor(i)), borderWidth: 3, borderColor: 'transparent', hoverOffset: 6 }]
    };
  });

  // Antigüedad de la mora: 1 mes, 2 meses y 3 o más sobre el comprobante impago más viejo de cada unidad.
  readonly aging = computed(() => {
    const labels = this.t().panel.aging;
    const buckets = labels.map((label, i) => ({ label, units: 0, amount: 0, share: 0, color: AGING_COLORS[i] }));
    for (const x of this.store.overdueUnits) {
      const b = buckets[Math.min(Math.max(x.months, 1), 3) - 1];
      b.units++;
      b.amount += x.amount;
    }
    const total = buckets.reduce((s, b) => s + b.amount, 0) || 1;
    return buckets.map((b) => ({ ...b, share: Math.round((b.amount / total) * 100) }));
  });

  readonly topDebtors = computed(() => this.store.overdueUnits.slice(0, 5));

  readonly monthlyOptions: unknown;
  readonly donutOptions: unknown;

  constructor() {
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color') || '#334155';
    const gridColor = style.getPropertyValue('--surface-border') || 'rgba(0,0,0,0.08)';
    const compact = (v: number | string) => new Intl.NumberFormat('es-PY', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v));

    this.monthlyOptions = {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: textColor, usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: (ctx: { dataset: { label: string }; parsed: { y: number } }) => ` ${ctx.dataset.label}: ${this.gs(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { display: false } },
        y: { position: 'left', ticks: { color: textColor, callback: compact }, grid: { color: gridColor } }
      }
    };

    this.donutOptions = {
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx: { label: string; parsed: number }) => ` ${ctx.label}: ${this.gs(ctx.parsed)}` } }
      }
    };
  }

  categoryColor(i: number): string {
    return CATEGORY_COLORS[i % CATEGORY_COLORS.length];
  }

  /** Offset del anillo SVG. Radio=50, circunferencia=2π×50≈314.16 */
  ringOffset(pct: number): number {
    return 314.16 * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  }

  select(id: string): void {
    this.selectedId.set(id);
    this.store.complete('panel');
  }
}
