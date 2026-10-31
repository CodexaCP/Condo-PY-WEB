import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatGs } from '../condo/finance-format';
import { DEMO_PAGE_STYLES } from './demo.styles';
import { DemoStore } from './demo.store';

type Tab = 'ingresos' | 'morosidad' | 'rubros';

// Misión 4: informes. La misión se cumple al mirar al menos dos de los tres informes.
@Component({
  standalone: true,
  selector: 'app-demo-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <h1>{{ t().reports.title }}</h1>
    <p class="sub">{{ t().reports.sub }}</p>

    <div class="tabs" role="tablist">
      <button type="button" role="tab" [class.on]="tab() === 'ingresos'" (click)="open('ingresos')">{{ t().reports.tabs.ingresos }}</button>
      <button type="button" role="tab" [class.on]="tab() === 'morosidad'" (click)="open('morosidad')">{{ t().reports.tabs.morosidad }}</button>
      <button type="button" role="tab" [class.on]="tab() === 'rubros'" (click)="open('rubros')">{{ t().reports.tabs.rubros }}</button>
    </div>

    @switch (tab()) {
      @case ('ingresos') {
        <div class="card">
          <h2>{{ t().reports.monthlyTitle }}</h2>
          <div class="tbl-wrap">
            <table class="tb">
              <thead><tr><th>{{ t().reports.monthlyCols.month }}</th><th class="num">{{ t().reports.monthlyCols.issued }}</th><th class="num">{{ t().reports.monthlyCols.collected }}</th><th class="num">{{ t().reports.monthlyCols.rate }}</th><th class="num">{{ t().reports.monthlyCols.expenses }}</th><th class="num">{{ t().reports.monthlyCols.result }}</th></tr></thead>
              <tbody>
                @for (r of monthly(); track r.label) {
                  <tr>
                    <td><b>{{ r.label }}</b></td>
                    <td class="num">{{ gs(r.charged) }}</td>
                    <td class="num">{{ gs(r.collected) }}</td>
                    <td class="num">{{ t().percent(r.rate) }}</td>
                    <td class="num">{{ gs(r.expense) }}</td>
                    <td class="num" [class.pos]="r.result >= 0" [class.neg]="r.result < 0"><b>{{ gs(r.result) }}</b></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="muted note">{{ t().reports.monthlyNote }}</p>
        </div>
      }
      @case ('morosidad') {
        <div class="aging">
          @for (b of store.aging(); track b.label) {
            <div class="card"><span class="muted">{{ b.label }}</span><strong>{{ gs(b.amount) }}</strong><small>{{ t().reports.unitCount(b.units) }}</small></div>
          }
        </div>
        <div class="card">
          <h2>{{ t().reports.overdueTitle }}</h2>
          <div class="tbl-wrap">
            <table class="tb">
              <thead><tr><th>{{ t().reports.overdueCols.unit }}</th><th>{{ t().reports.overdueCols.owner }}</th><th class="num">{{ t().reports.overdueCols.months }}</th><th class="num">{{ t().reports.overdueCols.debt }}</th><th></th></tr></thead>
              <tbody>
                @for (x of store.overdueUnits; track x.unit.code) {
                  <tr>
                    <td><b>{{ x.unit.code }}</b></td>
                    <td>{{ x.unit.owner }}</td>
                    <td class="num">{{ x.months }}</td>
                    <td class="num neg"><b>{{ gs(x.amount) }}</b></td>
                    <td><a [routerLink]="['/explorar/unidades', x.unit.code]">{{ t().reports.statementLink }}</a></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
      @case ('rubros') {
        <div class="card">
          <h2>{{ t().reports.byCategory(store.currentPeriodLabel()) }}</h2>
          <ul class="cats">
            @for (c of store.expensesByCategory(); track c.category) {
              <li><span>{{ c.label }}</span><div class="meter"><i [style.width.%]="c.share"></i></div><b>{{ t().percent(c.share) }}</b><em>{{ gs(c.amount) }}</em></li>
            }
          </ul>
        </div>
      }
    }

    <div class="card more">
      <i class="pi pi-lock"></i>
      <span>{{ t().reports.more }}<b>{{ t().reports.moreBold }}</b>{{ t().reports.moreRest }}</span>
      <a routerLink="/explorar/bloqueado" [queryParams]="{ f: 'mas' }">{{ t().reports.learnMore }}</a>
    </div>
  `,
  styles: [
    DEMO_PAGE_STYLES,
    `
      .tabs { display: flex; gap: 0.4rem; margin-bottom: 1rem; flex-wrap: wrap; }
      .tabs button { cursor: pointer; font: inherit; font-size: 0.88rem; font-weight: 700; padding: 0.5rem 1rem; border-radius: 0.6rem; border: 1px solid var(--ex-line, #dbe6ef); background: #fff; color: var(--ex-muted, #5f7b88); }
      .tabs button.on { background: #1385b6; border-color: #1385b6; color: #fff; }
      .note { margin: 0.8rem 0 0; font-size: 0.82rem; }
      .aging { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.8rem; margin-bottom: 1rem; }
      .aging .card { display: grid; gap: 0.2rem; }
      .aging strong { font-size: 1.25rem; }
      .aging small { color: var(--ex-muted, #5f7b88); }
      .cats { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
      .cats li { display: grid; grid-template-columns: 8rem 1fr 3rem 7.5rem; align-items: center; gap: 0.7rem; font-size: 0.88rem; }
      .cats em { font-style: normal; text-align: right; color: var(--ex-muted, #5f7b88); }
      .meter { height: 10px; border-radius: 999px; background: #e6eef4; overflow: hidden; }
      .meter i { display: block; height: 100%; background: #1ab7af; }
      @media (max-width: 640px) { .cats li { grid-template-columns: 6rem 1fr 2.6rem; } .cats em { display: none; } }
      .more { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; margin-top: 1rem; background: #f6fafc; }
      .more i { color: #1385b6; }
      .more span { flex: 1; min-width: 220px; font-size: 0.88rem; }
    `
  ]
})
export class DemoReportsComponent {
  readonly store = inject(DemoStore);
  readonly t = this.store.t;
  readonly gs = formatGs;
  readonly tab = signal<Tab>('ingresos');
  private readonly visited = signal<Tab[]>(['ingresos']);

  readonly monthly = computed(() => {
    const chart = this.store.chart();
    return this.store.months.map((m, i) => ({
      label: this.store.periodLabel(m.period),
      charged: m.charged,
      collected: m.collected,
      rate: m.charged ? Math.round((m.collected / m.charged) * 100) : 0,
      expense: chart[i].expense,
      result: m.collected - chart[i].expense
    }));
  });

  constructor() {
    effect(() => {
      if (this.visited().length >= 2) untracked(() => this.store.complete('informes'));
    });
  }

  open(t: Tab): void {
    this.tab.set(t);
    if (!this.visited().includes(t)) this.visited.update((v) => [...v, t]);
  }
}
