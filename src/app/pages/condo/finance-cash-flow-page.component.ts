import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinanceBuildingAccess, FinanceCashFlow, FinanceCashFlowLine } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe, monthShort, NumPipe } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';

interface FlowGroup {
  code: string;
  name: string;
  lines: FinanceCashFlowLine[];
  subtotal: number[];
  total: number;
}

// Flujo de caja del ejercicio: entradas y salidas por rubro, mes a mes, con el saldo de cierre. Por lo percibido (cobrado y pagado),
// desde la fecha de arranque y hasta hoy; los meses que todavia no llegaron quedan en blanco.
@Component({
  standalone: true,
  selector: 'app-finance-cash-flow-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Card, GsPipe, NumPipe, FinanceBuildingPickerComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Flujo de caja</h1>
            <p>Entradas y salidas por rubro, mes a mes, y el saldo de cierre de cada mes.</p>
          </div>
        </div>
        <div class="controls">
          <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
          <label class="field" *ngIf="data">
            <span>Ejercicio</span>
            <select [ngModel]="fiscalYear" (ngModelChange)="onYear($event)">
              <option *ngFor="let y of yearOptions" [ngValue]="y">{{ y }}</option>
            </select>
          </label>
        </div>
      </div>

      <app-finance-state [loading]="loading" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="data as d">
        <p class="muted small">
          Ejercicio {{ d.fiscalYear }}: {{ d.fiscalYearStart | date: 'dd/MM/yyyy' }} al {{ d.fiscalYearEnd | date: 'dd/MM/yyyy' }} · datos al {{ d.asOf | date: 'dd/MM/yyyy' }}.
          Saldo al comienzo del ejercicio: <strong>{{ d.openingBalance | gs }}</strong>.
        </p>

        <div class="table-wrap">
          <table class="cf-table">
            <thead>
              <tr>
                <th class="sticky">Rubro</th>
                <th class="num" *ngFor="let m of d.months" [class.future]="isFuture(m.year, m.month)">{{ short(m.year, m.month) }}</th>
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr class="section"><td class="sticky" [attr.colspan]="d.months.length + 2">Entradas</td></tr>
              <ng-container *ngFor="let g of inGroups">
                <tr class="group">
                  <td class="sticky"><code>{{ g.code }}</code> {{ g.name }}</td>
                  <td class="num" *ngFor="let v of g.subtotal; let i = index" [class.future]="isFutureIndex(i)">{{ v | num }}</td>
                  <td class="num">{{ g.total | num }}</td>
                </tr>
                <tr *ngFor="let l of g.lines">
                  <td class="sticky child"><code>{{ l.code }}</code> {{ l.name }}</td>
                  <td class="num" *ngFor="let v of l.amounts; let i = index" [class.future]="isFutureIndex(i)">{{ v ? (v | num) : '' }}</td>
                  <td class="num">{{ l.total | num }}</td>
                </tr>
              </ng-container>
              <tr class="total pos">
                <td class="sticky">Total entradas</td>
                <td class="num" *ngFor="let v of d.totalIn; let i = index" [class.future]="isFutureIndex(i)">{{ v | num }}</td>
                <td class="num">{{ sum(d.totalIn) | num }}</td>
              </tr>

              <tr class="section"><td class="sticky" [attr.colspan]="d.months.length + 2">Salidas</td></tr>
              <ng-container *ngFor="let g of outGroups">
                <tr class="group">
                  <td class="sticky"><code>{{ g.code }}</code> {{ g.name }}</td>
                  <td class="num" *ngFor="let v of g.subtotal; let i = index" [class.future]="isFutureIndex(i)">{{ v | num }}</td>
                  <td class="num">{{ g.total | num }}</td>
                </tr>
                <tr *ngFor="let l of g.lines">
                  <td class="sticky child"><code>{{ l.code }}</code> {{ l.name }}</td>
                  <td class="num" *ngFor="let v of l.amounts; let i = index" [class.future]="isFutureIndex(i)">{{ v ? (v | num) : '' }}</td>
                  <td class="num">{{ l.total | num }}</td>
                </tr>
              </ng-container>
              <tr class="total neg">
                <td class="sticky">Total salidas</td>
                <td class="num" *ngFor="let v of d.totalOut; let i = index" [class.future]="isFutureIndex(i)">{{ v | num }}</td>
                <td class="num">{{ sum(d.totalOut) | num }}</td>
              </tr>

              <tr class="total net">
                <td class="sticky">Neto del mes</td>
                <td class="num" *ngFor="let v of d.net; let i = index" [class.future]="isFutureIndex(i)" [class.neg]="v < 0">{{ v | num }}</td>
                <td class="num">{{ sum(d.net) | num }}</td>
              </tr>
              <tr class="total closing">
                <td class="sticky">Saldo al cierre</td>
                <td class="num" *ngFor="let v of d.closingBalance; let i = index" [class.future]="isFutureIndex(i)">{{ isFutureIndex(i) ? '' : (v | num) }}</td>
                <td class="num"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted small">Importes en guaraníes. Las entradas incluyen los cobros a propietarios (por tipo de cargo), los aportes al fondo de reserva y los ingresos del edificio; las salidas, los gastos. El aporte al fondo cargado como gasto no es una salida.</p>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .controls { display: flex; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .field { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .field select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .muted { color: var(--brand-muted); }
    .small { font-size: 0.85rem; }
    .table-wrap { overflow-x: auto; margin: 1rem 0; border: 1px solid var(--brand-border); border-radius: 12px; }
    .cf-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; min-width: 1100px; }
    .cf-table th, .cf-table td { padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--brand-border); white-space: nowrap; }
    .cf-table th { text-align: left; color: var(--brand-muted); font-weight: 700; background: var(--p-content-background, #fff); }
    .num { text-align: right !important; }
    .sticky { position: sticky; left: 0; background: var(--p-content-background, #fff); min-width: 260px; z-index: 1; }
    .child { padding-left: 1.6rem !important; color: var(--brand-ink-soft); }
    .section td { background: var(--brand-gradient-soft); font-weight: 800; color: var(--brand-ink); }
    .section td.sticky { background: var(--brand-gradient-soft); }
    .group td { font-weight: 700; }
    .total td { font-weight: 800; border-top: 2px solid var(--brand-border); }
    .pos td:not(.sticky) { color: #2f8f46; }
    .neg td:not(.sticky), td.neg { color: #c9473b; }
    .future { opacity: 0.35; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; color: var(--brand-muted); }
  `]
})
export class FinanceCashFlowPageComponent {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildingId = '';
  data: FinanceCashFlow | null = null;
  inGroups: FlowGroup[] = [];
  outGroups: FlowGroup[] = [];
  yearOptions: number[] = [];
  fiscalYear = 0;
  loading = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.fiscalYear = 0;
    this.load();
  }

  onError(err: unknown): void { this.setError(err); }

  onYear(year: number): void {
    if (!year || year === this.fiscalYear) return;
    this.fiscalYear = year;
    this.load();
  }

  short(year: number, month: number): string { return monthShort(year, month); }
  sum(values: number[]): number { return values.reduce((a, b) => a + b, 0); }

  // Los meses posteriores a la fecha de los datos no tienen movimientos todavia.
  isFutureIndex(i: number): boolean {
    const m = this.data?.months[i];
    return !!m && this.isFuture(m.year, m.month);
  }

  isFuture(year: number, month: number): boolean {
    if (!this.data) return false;
    const asOf = new Date(this.data.asOf + 'T00:00:00');
    return year > asOf.getFullYear() || (year === asOf.getFullYear() && month > asOf.getMonth() + 1);
  }

  private load(): void {
    this.loading = true;
    this.errorKind = '';
    this.api.getCashFlow(this.buildingId, this.fiscalYear || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data = data;
        this.fiscalYear = data.fiscalYear;
        this.inGroups = this.group(data.inLines);
        this.outGroups = this.group(data.outLines);
        const startYear = Number(data.financeStartDate.slice(0, 4));
        const years: number[] = [];
        for (let y = startYear - 1; y <= Math.max(data.fiscalYear, new Date().getFullYear()); y++) years.push(y);
        this.yearOptions = years;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => this.setError(err)
    });
  }

  private group(lines: FinanceCashFlowLine[]): FlowGroup[] {
    const map = new Map<string, FlowGroup>();
    for (const line of lines) {
      const key = line.groupCode || line.code;
      let group = map.get(key);
      if (!group) {
        group = { code: line.groupCode || line.code, name: line.groupName || line.name, lines: [], subtotal: new Array(12).fill(0), total: 0 };
        map.set(key, group);
      }

      group.lines.push(line);
      line.amounts.forEach((v, i) => (group!.subtotal[i] += v));
      group.total += line.total;
    }

    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  private setError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudo cargar el flujo de caja.');
    this.data = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}
