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
    <h1>Así está el edificio hoy</h1>
    <p class="sub">Haz clic en un indicador para descubrir de dónde sale la cifra.</p>

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
        <h2><i class="pi pi-search"></i> ¿De dónde sale «{{ s.label }}»?</h2>
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
        <h2>Ingresos y gastos · últimos 6 meses</h2>
        <div class="chart">
          @for (c of store.chart(); track c.label) {
            <div class="col">
              <div class="bars">
                <i class="b inc" [style.height.%]="pct(c.income)" [title]="'Cobrado: ' + gs(c.income)"></i>
                <i class="b exp" [style.height.%]="pct(c.expense)" [title]="'Gastos: ' + gs(c.expense)"></i>
              </div>
              <span>{{ c.label }}</span>
            </div>
          }
        </div>
        <div class="legend"><span><i class="inc"></i> Cobrado</span><span><i class="exp"></i> Gastos</span></div>
      </div>

      <div class="card">
        <h2>Últimos movimientos</h2>
        <ul class="mov">
          @for (m of store.lastMovements(); track m.id) {
            <li>
              <span class="d">{{ store.dateLabel(m.date) }}</span>
              <span class="t">{{ m.text }}</span>
              <b [class.pos]="m.income" [class.neg]="!m.income">{{ m.income ? '+' : '−' }} {{ gs(m.amount) }}</b>
            </li>
          }
        </ul>
        <a routerLink="/explorar/libro-diario" class="muted-link">Ver todos en el libro diario →</a>
      </div>
    </div>

    <div class="card alert">
      <i class="pi pi-exclamation-triangle"></i>
      <span><b>{{ store.overdueUnits.length }} unidades</b> tienen deuda vencida por {{ gs(store.overdueTotal) }}. </span>
      <a routerLink="/explorar/unidades" [queryParams]="{ deuda: 1 }">Ver quiénes son →</a>
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
  readonly gs = formatGs;
  readonly selectedId = signal<string | null>(null);

  readonly kpis = computed<Kpi[]>(() => {
    const s = this.store;
    const collected = s.collectedMonth;
    const expenses = s.expensesTotal();
    const rate = s.chargedMonth ? Math.round((collected / s.chargedMonth) * 100) : 0;
    const top = s.expensesByCategory().slice(0, 4).map((c) => ({ label: `${c.category} (${c.share} %)`, value: formatGs(c.amount) }));
    return [
      {
        id: 'cash', icon: 'pi-building-columns', label: 'Caja y bancos', value: formatGs(s.cashBalance()), note: 'Saldo disponible hoy', tone: 'teal',
        text: 'Es el saldo de apertura del mes, más lo cobrado a los propietarios, menos los gastos pagados.',
        rows: [{ label: 'Saldo de apertura del mes', value: formatGs(s.openingCash) }, { label: '+ Cobrado en el mes', value: formatGs(collected) }, { label: '− Gastos pagados en el mes', value: formatGs(expenses) }, { label: '= Saldo de hoy', value: formatGs(s.cashBalance()) }],
        link: { label: 'Ver los asientos en el libro diario', route: '/explorar/libro-diario' }
      },
      {
        id: 'collected', icon: 'pi-money-bill', label: 'Cobrado del mes', value: formatGs(collected), note: `${rate} % de lo emitido`, tone: 'blue',
        text: 'Suma de los pagos registrados este mes contra lo emitido en la liquidación de expensas.',
        rows: [{ label: 'Emitido en la liquidación', value: formatGs(s.chargedMonth) }, { label: `Cobrado (${s.paymentsMonth.length} pagos)`, value: formatGs(collected) }, { label: 'Porcentaje de cobranza', value: `${rate} %` }],
        link: { label: 'Revisar las unidades', route: '/explorar/unidades' }
      },
      {
        id: 'expenses', icon: 'pi-wallet', label: 'Gastos del mes', value: formatGs(expenses), note: `${s.expenses().length} gastos registrados`, tone: 'amber',
        text: 'Todos los gastos cargados este mes, agrupados por rubro. Si registras un gasto simulado, esta cifra cambia.',
        rows: top,
        link: { label: 'Ir a Gastos', route: '/explorar/gastos' }
      },
      {
        id: 'morosity', icon: 'pi-percentage', label: 'Morosidad', value: `${s.morosityPct.toString().replace('.', ',')} %`, note: `${s.overdueUnits.length} de ${s.units.length} unidades`, tone: 'coral',
        text: 'Unidades con al menos una expensa vencida y sin pagar, sobre el total de unidades del edificio.',
        rows: [{ label: 'Unidades con deuda vencida', value: `${s.overdueUnits.length}` }, { label: 'Total de unidades', value: `${s.units.length}` }, { label: 'Deuda vencida total', value: formatGs(s.overdueTotal) }],
        link: { label: 'Ver las unidades con deuda', route: '/explorar/unidades', query: { deuda: 1 } }
      },
      {
        id: 'pending', icon: 'pi-clock', label: 'Pendiente de cobro', value: formatGs(s.pendingTotal), note: 'Vencido y por vencer', tone: 'violet',
        text: 'Todo lo emitido que todavía no se cobró: la deuda vencida más las expensas del mes que aún no vencen.',
        rows: [{ label: 'Deuda vencida', value: formatGs(s.overdueTotal) }, { label: 'Por vencer', value: formatGs(Math.max(s.pendingTotal - s.overdueTotal, 0)) }]
      },
      {
        id: 'reserve', icon: 'pi-shield', label: 'Fondo de reserva', value: formatGs(s.reserveFund), note: 'Ahorro del edificio', tone: 'teal',
        text: 'Dinero apartado para imprevistos y obras mayores, separado del saldo operativo.',
        rows: [{ label: 'Saldo del fondo de reserva', value: formatGs(s.reserveFund) }]
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
