import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { FinanceApiService } from '../../api/finance-api.service';
import { BudgetStatus, FinanceBudgetTotals, FinanceBudgetVsActual, FinanceBudgetVsActualLine, FinanceBuildingAccess } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe, monthLabel, NumPipe } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';

interface LineGroup {
  code: string;
  name: string;
  lines: FinanceBudgetVsActualLine[];
}

const STATUS_LABEL: Record<BudgetStatus, string> = {
  None: 'Sin datos',
  Green: 'Dentro de lo presupuestado',
  Amber: 'Desvío de hasta el límite',
  Red: 'Desvío mayor al límite'
};

// Presupuesto vs. real por rubro, del mes y acumulado del ejercicio, con semaforo. Lo real de los gastos es lo cargado como gasto del
// edificio (por fecha, incluido lo pagado por el fondo de reserva); lo real de los ingresos es lo cobrado.
@Component({
  standalone: true,
  selector: 'app-finance-budget-vs-actual-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Card, GsPipe, NumPipe, FinanceBuildingPickerComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Presupuesto vs. real</h1>
            <p>Lo presupuestado contra lo que pasó, por rubro, en el mes y acumulado del ejercicio.</p>
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

      <app-finance-state [loading]="loading" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="data as d">
        <div class="legend">
          <span><i class="dot green"></i> Dentro de lo presupuestado</span>
          <span><i class="dot amber"></i> Desvío de hasta {{ d.amberThresholdPct }} %</span>
          <span><i class="dot red"></i> Desvío mayor a {{ d.amberThresholdPct }} %</span>
          <span class="basis">Gastos: <strong>{{ d.expenseBasis.toLowerCase() }}</strong> · Ingresos: <strong>{{ d.incomeBasis.toLowerCase() }}</strong> · datos al {{ d.asOf | date: 'dd/MM/yyyy' }}</span>
        </div>

        <p class="empty" *ngIf="!incomeGroups.length && !expenseGroups.length">
          Todavía no hay presupuesto cargado ni movimientos en este ejercicio.
          <a [routerLink]="['/finance/budget']" [queryParams]="{ buildingId: d.buildingId }">Cargar el presupuesto</a>
        </p>

        <ng-container *ngFor="let section of sectionList">
          <h2>{{ section.title }}</h2>
          <div class="table-wrap">
            <table class="vs-table">
              <thead>
                <tr>
                  <th class="sticky" rowspan="2">Rubro</th>
                  <th class="center" colspan="5">{{ monthText }}</th>
                  <th class="center" colspan="5">Acumulado del ejercicio {{ d.fiscalYear }}</th>
                </tr>
                <tr>
                  <th class="num">Presupuesto</th><th class="num">Real</th><th class="num">Desvío</th><th class="num">%</th><th></th>
                  <th class="num">Presupuesto</th><th class="num">Real</th><th class="num">Desvío</th><th class="num">%</th><th></th>
                </tr>
              </thead>
              <tbody>
                <ng-container *ngFor="let g of section.groups">
                  <tr class="group">
                    <td class="sticky"><code>{{ g.code }}</code> {{ g.name }}</td>
                    <td class="num">{{ sum(g, 'monthBudget') | num }}</td><td class="num">{{ sum(g, 'monthActual') | num }}</td>
                    <td class="num">{{ sum(g, 'monthActual') - sum(g, 'monthBudget') | num }}</td><td></td><td></td>
                    <td class="num">{{ sum(g, 'ytdBudget') | num }}</td><td class="num">{{ sum(g, 'ytdActual') | num }}</td>
                    <td class="num">{{ sum(g, 'ytdActual') - sum(g, 'ytdBudget') | num }}</td><td></td><td></td>
                  </tr>
                  <tr *ngFor="let l of g.lines">
                    <td class="sticky child"><code>{{ l.code }}</code> {{ l.name }}</td>
                    <td class="num">{{ l.monthBudget | num }}</td>
                    <td class="num">{{ l.monthActual | num }}</td>
                    <td class="num" [class.over]="over(l, 'month')">{{ l.monthVariance | num }}</td>
                    <td class="num">{{ pct(l.monthVariancePct) }}</td>
                    <td><i class="dot" [ngClass]="cls(l.monthStatus)" [title]="label(l.monthStatus)"></i></td>
                    <td class="num">{{ l.ytdBudget | num }}</td>
                    <td class="num">{{ l.ytdActual | num }}</td>
                    <td class="num" [class.over]="over(l, 'ytd')">{{ l.ytdVariance | num }}</td>
                    <td class="num">{{ pct(l.ytdVariancePct) }}</td>
                    <td><i class="dot" [ngClass]="cls(l.ytdStatus)" [title]="label(l.ytdStatus)"></i></td>
                  </tr>
                </ng-container>
                <tr class="total">
                  <td class="sticky">Total {{ section.title.toLowerCase() }}</td>
                  <td class="num">{{ section.totals.monthBudget | num }}</td>
                  <td class="num">{{ section.totals.monthActual | num }}</td>
                  <td class="num">{{ section.totals.monthActual - section.totals.monthBudget | num }}</td><td></td>
                  <td><i class="dot" [ngClass]="cls(section.totals.monthStatus)" [title]="label(section.totals.monthStatus)"></i></td>
                  <td class="num">{{ section.totals.ytdBudget | num }}</td>
                  <td class="num">{{ section.totals.ytdActual | num }}</td>
                  <td class="num">{{ section.totals.ytdActual - section.totals.ytdBudget | num }}</td><td></td>
                  <td><i class="dot" [ngClass]="cls(section.totals.ytdStatus)" [title]="label(section.totals.ytdStatus)"></i></td>
                </tr>
              </tbody>
            </table>
          </div>
        </ng-container>

        <p class="muted small" *ngIf="incomeGroups.length || expenseGroups.length">
          Desvío = real − presupuestado. En los gastos preocupa pasarse; en los ingresos, quedar por debajo de lo esperado. Un gasto sin presupuesto cuenta como desvío.
          Resultado del mes (real): <strong>{{ d.incomeTotals.monthActual - d.expenseTotals.monthActual | gs }}</strong>.
        </p>
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
    .legend { display: flex; gap: 1.2rem; flex-wrap: wrap; align-items: center; font-size: 0.86rem; color: var(--brand-ink-soft); margin-bottom: 0.5rem; }
    .legend .basis { margin-left: auto; color: var(--brand-muted); }
    .dot { display: inline-block; width: 0.8rem; height: 0.8rem; border-radius: 50%; vertical-align: middle; background: var(--brand-border); }
    .dot.green { background: #3aa655; }
    .dot.amber { background: #e0a526; }
    .dot.red { background: #d6483b; }
    .dot.none { background: transparent; border: 1px dashed var(--brand-border); }
    h2 { margin: 1.4rem 0 0.6rem; font-size: 1.2rem; color: var(--brand-ink); }
    .empty { padding: 1rem; border-radius: 12px; background: var(--brand-gradient-soft); color: var(--brand-ink-soft); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--brand-border); border-radius: 12px; }
    .vs-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; min-width: 1150px; }
    .vs-table th, .vs-table td { padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--brand-border); white-space: nowrap; }
    .vs-table th { color: var(--brand-muted); font-weight: 700; background: var(--p-content-background, #fff); text-align: left; }
    .vs-table th.center { text-align: center; border-bottom: 1px solid var(--brand-border); }
    .num { text-align: right !important; }
    .sticky { position: sticky; left: 0; background: var(--p-content-background, #fff); min-width: 250px; z-index: 1; }
    .child { padding-left: 1.5rem !important; color: var(--brand-ink-soft); }
    .group td { font-weight: 700; background: rgba(19,133,182,0.04); }
    .group td.sticky { background: var(--brand-gradient-soft); }
    .total td { font-weight: 800; border-top: 2px solid var(--brand-border); }
    .over { color: #c9473b; font-weight: 700; }
    .muted { color: var(--brand-muted); }
    .small { font-size: 0.85rem; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; color: var(--brand-muted); }
  `]
})
export class FinanceBudgetVsActualPageComponent {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  buildingId = '';
  data: FinanceBudgetVsActual | null = null;
  incomeGroups: LineGroup[] = [];
  expenseGroups: LineGroup[] = [];
  sectionList: { title: string; groups: LineGroup[]; totals: FinanceBudgetTotals }[] = [];
  loading = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';
  monthValue = '';
  minMonth = '';
  maxMonth = '';

  get monthText(): string { return this.data ? monthLabel(this.data.year, this.data.month) : ''; }

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

  onError(err: unknown): void { this.setError(err); }

  onMonth(value: string): void {
    if (!value || value === this.monthValue) return;
    this.monthValue = value;
    this.load();
  }

  sum(g: LineGroup, key: 'monthBudget' | 'monthActual' | 'ytdBudget' | 'ytdActual'): number {
    return g.lines.reduce((total, l) => total + l[key], 0);
  }

  cls(status: BudgetStatus): string { return status === 'Green' ? 'green' : status === 'Amber' ? 'amber' : status === 'Red' ? 'red' : 'none'; }
  label(status: BudgetStatus): string { return STATUS_LABEL[status]; }
  pct(v: number | null): string { return v === null ? '—' : `${v > 0 ? '+' : ''}${v.toLocaleString('es-PY', { maximumFractionDigits: 1 })} %`; }

  // Un gasto por encima de lo presupuestado se resalta; en ingresos, el desvio negativo.
  over(l: FinanceBudgetVsActualLine, period: 'month' | 'ytd'): boolean {
    const variance = period === 'month' ? l.monthVariance : l.ytdVariance;
    return l.type === 'Expense' ? variance > 0 : variance < 0;
  }

  private load(): void {
    const [year, month] = this.monthValue ? this.monthValue.split('-').map(Number) : [undefined, undefined];
    this.loading = true;
    this.errorKind = '';
    this.api.getBudgetVsActual(this.buildingId, year, month).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.monthValue = `${data.year}-${String(data.month).padStart(2, '0')}`;
        const now = new Date();
        this.maxMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        this.minMonth = `${data.fiscalYearStart.slice(0, 4)}-01`;
        this.incomeGroups = this.group(data.incomeLines);
        this.expenseGroups = this.group(data.expenseLines);
        this.sectionList = [
          { title: 'Ingresos', groups: this.incomeGroups, totals: data.incomeTotals },
          { title: 'Gastos', groups: this.expenseGroups, totals: data.expenseTotals }
        ].filter(s => s.groups.length > 0);
        this.cdr.markForCheck();
      },
      error: err => this.setError(err)
    });
  }

  private group(lines: FinanceBudgetVsActualLine[]): LineGroup[] {
    const map = new Map<string, LineGroup>();
    for (const line of lines) {
      const key = line.groupCode || line.code;
      let g = map.get(key);
      if (!g) {
        g = { code: line.groupCode || line.code, name: line.groupName || line.name, lines: [] };
        map.set(key, g);
      }

      g.lines.push(line);
    }

    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  private setError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudo cargar el presupuesto vs. real.');
    this.data = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}
