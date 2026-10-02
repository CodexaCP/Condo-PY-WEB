import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinanceBuildingAccess, FinanceReserveFund } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { FinanceExportButtonComponent, FinanceExportParams } from './finance-export-button.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe, monthLabel, monthShort } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';

// Libro del fondo de reserva: lo que entra (aportes cobrados a los propietarios y, si el edificio los manda al fondo, sus ingresos
// propios) y lo que sale (gastos pagados por el fondo), mes a mes desde la fecha de arranque, con el saldo de apertura de su cuenta.
@Component({
  standalone: true,
  selector: 'app-finance-reserve-fund-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Card, ChartModule, Message, Tag, GsPipe, FinanceBuildingPickerComponent, FinanceExportButtonComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Fondo de reserva</h1>
            <p>Aportes, usos y saldo del fondo, mes a mes.</p>
          </div>
        </div>
        <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
        <app-finance-export-button kind="reserve-fund" [buildingId]="buildingId" [params]="exportParams" fileLabel="fondo-de-reserva"
                                   [period]="to.split('-').join('')" [disabled]="!data"></app-finance-export-button>
      </div>

      <app-finance-state [loading]="loading" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="data as d">
        <ng-container *ngIf="!d.hasFundAccount">
          <p-message severity="info" text="Este edificio todavía no tiene una cuenta de «Fondo de reserva». Creala en Configuración → Cuentas para ver aquí sus aportes y usos."></p-message>
          <p class="link"><a [routerLink]="['/finance/settings']" [queryParams]="{ buildingId: d.buildingId }">Ir a Configuración</a></p>
        </ng-container>

        <ng-container *ngIf="d.hasFundAccount">
          <p class="muted small">
            Cuenta «{{ d.accountName }}» · desde el {{ d.financeStartDate | date: 'dd/MM/yyyy' }} hasta el {{ d.asOf | date: 'dd/MM/yyyy' }}
            <ng-container *ngIf="d.reserveFundPercentage !== null"> · aporte del edificio: {{ d.reserveFundPercentage }} % de los gastos comunes</ng-container>.
          </p>

          <div class="kpis">
            <div class="kpi main"><span>Saldo actual</span><strong>{{ d.balance | gs }}</strong></div>
            <div class="kpi"><span>Saldo inicial</span><strong>{{ d.openingBalance | gs }}</strong></div>
            <div class="kpi"><span>Aportes cobrados</span><strong class="pos">{{ d.contributions | gs }}</strong></div>
            <div class="kpi"><span>Usos (gastos pagados por el fondo)</span><strong class="neg">{{ d.uses | gs }}</strong></div>
          </div>

          <h2>Evolución</h2>
          <div class="chart-box" *ngIf="chartData">
            <p-chart type="bar" [data]="chartData" [options]="chartOptions" height="300px"></p-chart>
          </div>

          <h2>Mes a mes</h2>
          <div class="table-wrap">
            <table class="rf-table">
              <thead><tr><th>Mes</th><th class="num">Saldo inicial</th><th class="num">Aportes</th><th class="num">Usos</th><th class="num">Saldo final</th></tr></thead>
              <tbody>
                <tr *ngFor="let m of monthsDesc">
                  <td>{{ monthName(m.year, m.month) }}</td>
                  <td class="num">{{ m.opening | gs }}</td>
                  <td class="num pos">{{ m.contributions ? (m.contributions | gs) : '' }}</td>
                  <td class="num neg">{{ m.uses ? (m.uses | gs) : '' }}</td>
                  <td class="num"><strong>{{ m.closing | gs }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>Movimientos del fondo</h2>
          <div class="range">
            <label><span>Desde</span><input type="date" [(ngModel)]="from" (ngModelChange)="reload()" /></label>
            <label><span>Hasta</span><input type="date" [(ngModel)]="to" (ngModelChange)="reload()" /></label>
          </div>
          <p class="muted small" *ngIf="!d.movements.items.length">No hay movimientos del fondo en el rango.</p>
          <div class="table-wrap" *ngIf="d.movements.items.length">
            <table class="rf-table">
              <thead><tr><th>Fecha</th><th>Detalle</th><th class="num">Aporte</th><th class="num">Uso</th><th class="num">Saldo</th></tr></thead>
              <tbody>
                <tr *ngFor="let m of d.movements.items">
                  <td class="nowrap">{{ m.date | date: 'dd/MM/yyyy' }}</td>
                  <td>
                    {{ m.description }}
                    <small class="muted" *ngIf="m.thirdParty"><br />{{ m.thirdParty }}</small>
                    <p-tag *ngIf="m.direction === 'In'" value="Aporte" severity="success" styleClass="tag-sm"></p-tag>
                    <p-tag *ngIf="m.direction === 'Out'" value="Uso" severity="danger" styleClass="tag-sm"></p-tag>
                  </td>
                  <td class="num pos">{{ m.direction === 'In' ? (m.amount | gs) : '' }}</td>
                  <td class="num neg">{{ m.direction === 'Out' ? (m.amount | gs) : '' }}</td>
                  <td class="num"><strong>{{ m.runningBalance | gs }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="muted small">
            Este saldo parte del saldo inicial de la cuenta del fondo y suma lo cobrado desde la fecha de arranque; puede diferir del «saldo acumulado» que arrastra la liquidación de cada período.
          </p>
        </ng-container>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .muted { color: var(--brand-muted); }
    .small { font-size: 0.85rem; }
    .link { margin: 0.5rem 0; font-weight: 600; }
    h2 { margin: 1.5rem 0 0.7rem; font-size: 1.2rem; color: var(--brand-ink); }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; margin-top: 0.8rem; }
    .kpi { display: grid; gap: 0.3rem; padding: 1rem 1.1rem; border-radius: 14px; background: var(--p-content-background, #fff); border: 1px solid var(--brand-border); }
    .kpi span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .kpi strong { font-size: 1.3rem; color: var(--brand-ink); }
    .kpi.main { background: var(--brand-gradient-soft); border-color: transparent; }
    .kpi.main strong { font-size: 1.55rem; }
    .pos { color: #2f8f46 !important; }
    .neg { color: #c9473b !important; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--brand-border); border-radius: 12px; }
    .rf-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .rf-table th { text-align: left; padding: 0.5rem 0.7rem; color: var(--brand-muted); font-weight: 700; border-bottom: 1px solid var(--brand-border); white-space: nowrap; }
    .rf-table td { padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--brand-border); vertical-align: top; }
    .num { text-align: right !important; white-space: nowrap; }
    .nowrap { white-space: nowrap; }
    .range { display: flex; gap: 0.8rem; margin-bottom: 0.8rem; flex-wrap: wrap; }
    .range label { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .range input {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.92rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    :host ::ng-deep .tag-sm .p-tag { font-size: 0.65rem; padding: 0.05rem 0.4rem; margin-left: 0.4rem; }
    @media (max-width: 900px) { .kpis { grid-template-columns: 1fr 1fr; } }
  `]
})
export class FinanceReserveFundPageComponent {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildingId = '';
  data: FinanceReserveFund | null = null;
  monthsDesc: FinanceReserveFund['months'] = [];
  loading = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';
  from = '';
  to = '';
  chartData: unknown = null;
  chartOptions: unknown = null;

  monthName(year: number, month: number): string { return monthLabel(year, month); }

  readonly exportParams = (): FinanceExportParams => ({ from: this.from, to: this.to });

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.from = this.to = '';
    this.load();
  }

  onError(err: unknown): void { this.setError(err); }

  reload(): void { this.load(); }

  private load(): void {
    this.loading = true;
    this.errorKind = '';
    this.api.getReserveFund(this.buildingId, this.from || undefined, this.to || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.from = data.movements.from;
        this.to = data.movements.to;
        this.monthsDesc = [...data.months].reverse();
        this.buildChart(data);
        this.cdr.markForCheck();
      },
      error: err => this.setError(err)
    });
  }

  private buildChart(d: FinanceReserveFund): void {
    this.chartData = {
      labels: d.months.map(m => monthShort(m.year, m.month)),
      datasets: [
        { type: 'line', label: 'Saldo del fondo', data: d.months.map(m => m.closing), borderColor: '#1385B6', backgroundColor: '#1385B6', yAxisID: 'y1', tension: 0.25 },
        { type: 'bar', label: 'Aportes', data: d.months.map(m => m.contributions), backgroundColor: '#6AC64A', yAxisID: 'y' },
        { type: 'bar', label: 'Usos', data: d.months.map(m => m.uses), backgroundColor: '#e5675d', yAxisID: 'y' }
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

  private setError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudo cargar el fondo de reserva.');
    this.data = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}
