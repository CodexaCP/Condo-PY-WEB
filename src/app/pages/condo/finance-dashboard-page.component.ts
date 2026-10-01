import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { Message } from 'primeng/message';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinanceBuildingAccess, FinanceDashboard, FinanceRubroAmount } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe, monthLabel, monthShort } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';

// Tablero del modulo «Finanzas del edificio»: cuanto hay en cada cuenta, cuanto entro y salio en el mes y en el ejercicio, y
// la evolucion de los ultimos meses. Caja y saldos por lo percibido (cobrado y pagado), hasta hoy y desde la fecha de arranque.
@Component({
  standalone: true,
  selector: 'app-finance-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Card, ChartModule, Message, GsPipe, FinanceBuildingPickerComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Tablero financiero</h1>
            <p>Saldos, flujo del mes y evolución del edificio.</p>
          </div>
        </div>
        <div class="controls">
          <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
          <label class="field" *ngIf="data">
            <span>Mes</span>
            <input type="month" [ngModel]="monthValue" (ngModelChange)="onMonth($event)" [min]="minMonth" [max]="maxMonth" />
          </label>
        </div>
      </div>

      <div class="disclaimer">
        <i class="pi pi-info-circle"></i>
        <span>
          Caja y saldos por lo <strong>percibido</strong> (lo cobrado y pagado), desde la fecha de arranque y hasta hoy.
          Este módulo no reemplaza al contador.
        </span>
      </div>

      <app-finance-state [loading]="loading" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="data as d">
        <p class="asof">Datos al {{ d.asOf | date: 'dd/MM/yyyy' }} · en el mes de {{ monthText }}</p>

        <div class="kpis">
          <div class="kpi main">
            <span>Saldo total</span>
            <strong>{{ d.balances.totalBalance | gs }}</strong>
          </div>
          <div class="kpi">
            <span>Caja</span>
            <strong>{{ d.balances.cashBalance | gs }}</strong>
          </div>
          <div class="kpi">
            <span>Bancos</span>
            <strong>{{ d.balances.bankBalance | gs }}</strong>
          </div>
          <div class="kpi">
            <span>Fondo de reserva</span>
            <strong>{{ d.balances.reserveFundBalance | gs }}</strong>
          </div>
        </div>

        <ng-container *ngFor="let w of d.balances.warnings">
          <p-message severity="warn" [text]="w"></p-message>
          <p class="link"><a [routerLink]="['/finance/settings']" [queryParams]="{ buildingId: d.buildingId }">Ir a Configuración</a></p>
        </ng-container>

        <h2>Cuentas</h2>
        <div class="app-list">
          <div class="app-row header acc-grid">
            <span>Cuenta</span>
            <span class="num">Saldo inicial</span>
            <span class="num">Entradas</span>
            <span class="num">Salidas</span>
            <span class="num">Saldo</span>
          </div>
          <div class="app-row acc-grid" *ngFor="let a of d.balances.accounts" [class.inactive]="!a.isActive">
            <span><strong>{{ a.name }}</strong> <small class="muted">{{ typeLabel(a.type) }}</small></span>
            <span class="num">{{ a.openingBalance | gs }}</span>
            <span class="num pos">{{ a.inflows | gs }}</span>
            <span class="num neg">{{ a.outflows | gs }}</span>
            <span class="num"><strong>{{ a.balance | gs }}</strong></span>
          </div>
          <div class="app-row acc-grid" *ngIf="d.balances.unassignedNet !== 0">
            <span><strong>Sin cuenta asignada</strong></span>
            <span></span><span></span><span></span>
            <span class="num"><strong>{{ d.balances.unassignedNet | gs }}</strong></span>
          </div>
        </div>
        <p class="muted small">Saldo = saldo inicial a la fecha de arranque ({{ d.financeStartDate | date: 'dd/MM/yyyy' }}) + entradas − salidas.</p>

        <h2>Flujo de {{ monthText }}</h2>
        <div class="kpis three">
          <div class="kpi"><span>Entradas</span><strong class="pos">{{ d.monthFlow.in | gs }}</strong></div>
          <div class="kpi"><span>Salidas</span><strong class="neg">{{ d.monthFlow.out | gs }}</strong></div>
          <div class="kpi"><span>Neto del mes</span><strong [class.pos]="d.monthFlow.net >= 0" [class.neg]="d.monthFlow.net < 0">{{ d.monthFlow.net | gs }}</strong></div>
        </div>
        <p class="muted small">
          Ejercicio {{ d.fiscalYear }} (desde {{ d.fiscalYearStart | date: 'dd/MM/yyyy' }}): entradas {{ d.fiscalYearToDate.in | gs }}, salidas {{ d.fiscalYearToDate.out | gs }}, neto {{ d.fiscalYearToDate.net | gs }}.
        </p>

        <div class="two-cols">
          <div>
            <h3>Entradas por rubro</h3>
            <p class="muted small" *ngIf="!d.monthIn.length">Sin entradas en el mes.</p>
            <div class="bar-row" *ngFor="let r of topRubros(d.monthIn)">
              <div class="bar-label"><span>{{ r.code }} · {{ r.name }}</span><strong>{{ r.amount | gs }}</strong></div>
              <div class="bar"><div class="fill in" [style.width.%]="share(r, d.monthIn)"></div></div>
            </div>
          </div>
          <div>
            <h3>Salidas por rubro</h3>
            <p class="muted small" *ngIf="!d.monthOut.length">Sin salidas en el mes.</p>
            <div class="bar-row" *ngFor="let r of topRubros(d.monthOut)">
              <div class="bar-label"><span>{{ r.code }} · {{ r.name }}</span><strong>{{ r.amount | gs }}</strong></div>
              <div class="bar"><div class="fill out" [style.width.%]="share(r, d.monthOut)"></div></div>
            </div>
          </div>
        </div>

        <h2>Evolución (últimos meses)</h2>
        <div class="chart-box" *ngIf="chartData">
          <p-chart type="bar" [data]="chartData" [options]="chartOptions" height="320px"></p-chart>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .controls { display: flex; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .field { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .field input {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .disclaimer {
      display: flex; gap: 0.6rem; align-items: flex-start; margin-bottom: 1rem; padding: 0.7rem 1rem;
      border-radius: 12px; background: var(--brand-gradient-soft); color: var(--brand-ink-soft); font-size: 0.9rem; line-height: 1.45;
    }
    .disclaimer i { margin-top: 0.15rem; color: var(--brand-c2); }
    .asof { margin: 0 0 1rem; color: var(--brand-muted); font-size: 0.9rem; }
    h2 { margin: 1.6rem 0 0.7rem; font-size: 1.2rem; color: var(--brand-ink); }
    h3 { margin: 0 0 0.6rem; font-size: 1rem; color: var(--brand-ink); }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; }
    .kpis.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .kpi {
      display: grid; gap: 0.3rem; padding: 1rem 1.1rem; border-radius: 14px;
      background: var(--p-content-background, #fff); border: 1px solid var(--brand-border);
    }
    .kpi span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi strong { font-size: 1.35rem; color: var(--brand-ink); }
    .kpi.main { background: var(--brand-gradient-soft); border-color: transparent; }
    .kpi.main strong { font-size: 1.6rem; }
    .pos { color: #2f8f46 !important; }
    .neg { color: #c9473b !important; }
    .muted { color: var(--brand-muted); }
    small.muted { margin-left: 0.4rem; font-weight: 400; }
    .small { font-size: 0.85rem; }
    .link { margin: 0.4rem 0 0.8rem; font-weight: 600; }
    .acc-grid { grid-template-columns: 2fr 1fr 1fr 1fr 1.2fr; padding: 0.7rem 1rem; }
    .num { text-align: right; }
    .inactive { opacity: 0.6; }
    .two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 1.2rem; }
    .bar-row { margin-bottom: 0.7rem; }
    .bar-label { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.88rem; color: var(--brand-ink-soft); }
    .bar { height: 7px; border-radius: 999px; background: var(--brand-border); margin-top: 0.25rem; overflow: hidden; }
    .fill { height: 100%; border-radius: 999px; }
    .fill.in { background: var(--brand-c3); }
    .fill.out { background: #e5675d; }
    .chart-box { padding: 0.5rem 0; }
    @media (max-width: 900px) {
      .kpis, .kpis.three, .two-cols { grid-template-columns: 1fr 1fr; }
      .two-cols { grid-template-columns: 1fr; }
      .acc-grid { grid-template-columns: 1fr 1fr; }
      .app-row.header { display: none; }
      .num { text-align: left; }
    }
  `]
})
export class FinanceDashboardPageComponent {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildingId = '';
  data: FinanceDashboard | null = null;
  loading = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';

  // Mes elegido en formato yyyy-MM (el del servidor, que lo acota entre el arranque y el mes actual).
  monthValue = '';
  minMonth = '';
  maxMonth = '';

  chartData: unknown = null;
  chartOptions: unknown = null;

  get monthText(): string { return this.data ? monthLabel(this.data.year, this.data.month).toLowerCase() : ''; }

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.monthValue = '';
    this.load();
  }

  onError(err: unknown): void {
    this.setError(err, 'No se pudo cargar el tablero.');
  }

  onMonth(value: string): void {
    if (!value || value === this.monthValue) return;
    this.monthValue = value;
    this.load();
  }

  topRubros(list: FinanceRubroAmount[]): FinanceRubroAmount[] { return list.filter(r => r.amount > 0).slice(0, 6); }

  share(r: FinanceRubroAmount, all: FinanceRubroAmount[]): number {
    const max = Math.max(...all.map(x => x.amount), 1);
    return Math.max(2, Math.round((r.amount / max) * 100));
  }

  typeLabel(type: string): string {
    return type === 'Cash' ? 'Caja' : type === 'Bank' ? 'Banco' : 'Fondo de reserva';
  }

  private load(): void {
    const [year, month] = this.monthValue ? this.monthValue.split('-').map(Number) : [undefined, undefined];
    this.loading = true;
    this.errorKind = '';
    this.errorMessage = '';

    this.api.getDashboard(this.buildingId, year, month).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.monthValue = `${data.year}-${String(data.month).padStart(2, '0')}`;
        this.minMonth = data.financeStartDate.slice(0, 7);
        const now = new Date();
        this.maxMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        this.buildChart(data);
        this.cdr.markForCheck();
      },
      error: err => this.setError(err, 'No se pudo cargar el tablero.')
    });
  }

  private setError(err: unknown, fallback: string): void {
    const { kind, message } = classifyFinanceError(err, fallback);
    this.data = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }

  private buildChart(d: FinanceDashboard): void {
    const labels = d.series.map(p => monthShort(p.year, p.month));
    this.chartData = {
      labels,
      datasets: [
        { type: 'line', label: 'Saldo total', data: d.series.map(p => p.endBalance), borderColor: '#1385B6', backgroundColor: '#1385B6', yAxisID: 'y1', tension: 0.25 },
        { type: 'bar', label: 'Entradas', data: d.series.map(p => p.in), backgroundColor: '#6AC64A', yAxisID: 'y' },
        { type: 'bar', label: 'Salidas', data: d.series.map(p => p.out), backgroundColor: '#e5675d', yAxisID: 'y' }
      ]
    };

    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color') || '#334155';
    const gridColor = style.getPropertyValue('--surface-border') || 'rgba(0,0,0,0.08)';
    const compact = (v: number | string) => new Intl.NumberFormat('es-PY', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(v));

    this.chartOptions = {
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor } } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { position: 'left', ticks: { color: textColor, callback: compact }, grid: { color: gridColor } },
        y1: { position: 'right', ticks: { color: textColor, callback: compact }, grid: { drawOnChartArea: false } }
      }
    };
  }
}
