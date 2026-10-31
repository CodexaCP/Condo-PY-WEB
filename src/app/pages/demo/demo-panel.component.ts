import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatGs } from '../condo/finance-format';
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

// Misión 1: el panel del edificio. Cada indicador se puede abrir para ver de dónde sale la cifra.
@Component({
  standalone: true,
  selector: 'app-demo-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <h1>{{ t().panel.title }}</h1>
    <p class="sub">{{ t().panel.sub }}</p>

    <div class="kpis">
      @for (k of kpis(); track k.id) {
        <button type="button" class="kpi" [class.sel]="selectedId() === k.id" [attr.data-tone]="k.tone" (click)="select(k.id)">
          <span class="ico"><i [class]="'pi ' + k.icon"></i></span>
          <span class="lbl">{{ k.label }}</span>
          <strong>{{ k.value }}</strong>
          <small>{{ k.note }}</small>
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

    <div class="grid2">
      <div class="card">
        <h2>{{ t().panel.chartTitle }}</h2>
        <div class="chart">
          @for (c of store.chart(); track c.label) {
            <div class="col">
              <div class="bars">
                <i class="b inc" [style.height.%]="pct(c.income)" [title]="t().panel.collectedTip + ': ' + gs(c.income)"></i>
                <i class="b exp" [style.height.%]="pct(c.expense)" [title]="t().panel.expensesTip + ': ' + gs(c.expense)"></i>
              </div>
              <span>{{ c.label }}</span>
            </div>
          }
        </div>
        <div class="legend"><span><i class="inc"></i> {{ t().panel.collectedTip }}</span><span><i class="exp"></i> {{ t().panel.expensesTip }}</span></div>
      </div>

      <div class="card">
        <h2>{{ t().panel.lastMovements }}</h2>
        <ul class="mov">
          @for (m of store.lastMovements(); track m.id) {
            <li>
              <span class="d">{{ store.dateLabel(m.date) }}</span>
              <span class="t">{{ m.text }}</span>
              <b [class.pos]="m.income" [class.neg]="!m.income">{{ m.income ? '+' : '−' }} {{ gs(m.amount) }}</b>
            </li>
          }
        </ul>
        <a routerLink="/explorar/libro-diario" class="muted-link">{{ t().panel.seeAll }}</a>
      </div>
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
      .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.8rem; margin-bottom: 1rem; }
      .kpi { position: relative; text-align: left; cursor: pointer; font: inherit; color: inherit; display: grid; gap: 0.15rem; padding: 0.9rem 1rem; border-radius: 0.9rem; border: 1px solid var(--ex-line, #dbe6ef); background: #fff; transition: transform 0.12s, box-shadow 0.12s; }
      .kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(22, 50, 74, 0.1); }
      .kpi.sel { border-color: #1ab7af; box-shadow: 0 0 0 2px rgba(26, 183, 175, 0.25); }
      .kpi .ico { width: 2rem; height: 2rem; border-radius: 0.6rem; display: grid; place-items: center; background: #e6f7f6; color: #0f8a84; }
      .kpi[data-tone='blue'] .ico { background: #e7f1f9; color: #1385b6; }
      .kpi[data-tone='coral'] .ico { background: #fdeceb; color: #c0392f; }
      .kpi[data-tone='amber'] .ico { background: #fff4d9; color: #8a6100; }
      .kpi[data-tone='violet'] .ico { background: #efe9fd; color: #6d3fd1; }
      .kpi .lbl { margin-top: 0.4rem; font-size: 0.78rem; font-weight: 700; color: var(--ex-muted, #5f7b88); }
      .kpi strong { font-size: 1.2rem; font-weight: 800; }
      .kpi small { color: var(--ex-muted, #5f7b88); font-size: 0.76rem; }
      .explain { margin-bottom: 1rem; border-color: #1ab7af; background: #f5fcfc; }
      .explain ul { list-style: none; margin: 0 0 0.8rem; padding: 0; }
      .explain li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; border-bottom: 1px dashed var(--ex-line, #dbe6ef); font-size: 0.9rem; }
      .chart { display: flex; align-items: flex-end; gap: 0.6rem; height: 190px; padding-top: 0.5rem; }
      .col { flex: 1; display: grid; gap: 0.3rem; justify-items: center; height: 100%; grid-template-rows: 1fr auto; font-size: 0.78rem; color: var(--ex-muted, #5f7b88); }
      .bars { display: flex; align-items: flex-end; gap: 4px; width: 100%; height: 100%; justify-content: center; }
      .b { display: block; width: 38%; max-width: 26px; border-radius: 5px 5px 0 0; min-height: 3px; transition: height 0.4s ease; }
      .inc { background: #1ab7af; }
      .exp { background: #f5a65b; }
      .legend { display: flex; gap: 1rem; margin-top: 0.6rem; font-size: 0.8rem; color: var(--ex-muted, #5f7b88); }
      .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 0.3rem; }
      .mov { list-style: none; margin: 0 0 0.6rem; padding: 0; }
      .mov li { display: grid; grid-template-columns: 4.6rem 1fr auto; gap: 0.5rem; padding: 0.45rem 0; border-bottom: 1px solid #eef3f7; font-size: 0.84rem; }
      .mov .d { color: var(--ex-muted, #5f7b88); }
      .mov .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .muted-link { font-size: 0.85rem; font-weight: 700; }
      .alert { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-top: 1rem; background: #fff8e8; border-color: #f2d58a; }
      .alert i { color: #b7791f; }
    `
  ]
})
export class DemoPanelComponent {
  readonly store = inject(DemoStore);
  readonly t = this.store.t;
  readonly gs = formatGs;
  readonly alert = computed(() => this.t().panel.alert(this.store.overdueUnits.length, formatGs(this.store.overdueTotal)));
  readonly selectedId = signal<string | null>(null);

  readonly kpis = computed<Kpi[]>(() => {
    const s = this.store;
    const tx = this.t();
    const k = tx.panel.kpi;
    const collected = s.collectedMonth;
    const expenses = s.expensesTotal();
    const rate = tx.percent(s.chargedMonth ? Math.round((collected / s.chargedMonth) * 100) : 0);
    const top = s.expensesByCategory().slice(0, 4).map((c) => ({ label: `${c.label} (${tx.percent(c.share)})`, value: formatGs(c.amount) }));
    return [
      {
        id: 'cash', icon: 'pi-building-columns', label: k.cash.label, value: formatGs(s.cashBalance()), note: k.cash.note, tone: 'teal',
        text: k.cash.text,
        rows: [{ label: k.cash.opening, value: formatGs(s.openingCash) }, { label: k.cash.plus, value: formatGs(collected) }, { label: k.cash.minus, value: formatGs(expenses) }, { label: k.cash.equals, value: formatGs(s.cashBalance()) }],
        link: { label: k.cash.link, route: '/explorar/libro-diario' }
      },
      {
        id: 'collected', icon: 'pi-money-bill', label: k.collected.label, value: formatGs(collected), note: k.collected.note(rate), tone: 'blue',
        text: k.collected.text,
        rows: [{ label: k.collected.issued, value: formatGs(s.chargedMonth) }, { label: k.collected.collectedWith(s.paymentsMonth.length), value: formatGs(collected) }, { label: k.collected.rate, value: rate }],
        link: { label: k.collected.link, route: '/explorar/unidades' }
      },
      {
        id: 'expenses', icon: 'pi-wallet', label: k.expenses.label, value: formatGs(expenses), note: k.expenses.note(s.expenses().length), tone: 'amber',
        text: k.expenses.text,
        rows: top,
        link: { label: k.expenses.link, route: '/explorar/gastos' }
      },
      {
        id: 'morosity', icon: 'pi-percentage', label: k.morosity.label, value: tx.percent(tx.decimal(s.morosityPct)), note: k.morosity.note(s.overdueUnits.length, s.units.length), tone: 'coral',
        text: k.morosity.text,
        rows: [{ label: k.morosity.withDebt, value: `${s.overdueUnits.length}` }, { label: k.morosity.totalUnits, value: `${s.units.length}` }, { label: k.morosity.totalDebt, value: formatGs(s.overdueTotal) }],
        link: { label: k.morosity.link, route: '/explorar/unidades', query: { deuda: 1 } }
      },
      {
        id: 'pending', icon: 'pi-clock', label: k.pending.label, value: formatGs(s.pendingTotal), note: k.pending.note, tone: 'violet',
        text: k.pending.text,
        rows: [{ label: k.pending.overdue, value: formatGs(s.overdueTotal) }, { label: k.pending.upcoming, value: formatGs(Math.max(s.pendingTotal - s.overdueTotal, 0)) }]
      },
      {
        id: 'reserve', icon: 'pi-shield', label: k.reserve.label, value: formatGs(s.reserveFund), note: k.reserve.note, tone: 'teal',
        text: k.reserve.text,
        rows: [{ label: k.reserve.balance, value: formatGs(s.reserveFund) }]
      }
    ];
  });

  readonly selected = computed(() => this.kpis().find((k) => k.id === this.selectedId()) ?? null);

  private readonly maxBar = computed(() => Math.max(1, ...this.store.chart().flatMap((c) => [c.income, c.expense])));

  pct(v: number): number {
    return Math.round((v / this.maxBar()) * 100);
  }

  select(id: string): void {
    this.selectedId.set(id);
    this.store.complete('panel');
  }
}
