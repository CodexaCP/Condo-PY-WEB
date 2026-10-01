import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinanceBudget, FinanceBudgetCell, FinanceBudgetRow, FinanceBuildingAccess, LedgerCategoryType } from '../../api/models';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { classifyFinanceError, FinanceErrorKind, GsPipe, monthShort, NumPipe } from './finance-format';
import { FinanceStateComponent } from './finance-state.component';

interface BudgetGroup {
  code: string;
  name: string;
  rows: FinanceBudgetRow[];
}

// Presupuesto mensual por rubro de ingresos y gastos. Grilla editable (rubro por mes) para quien configura (SuperAdmin y Administrador
// de empresa); los demas roles la consultan. Se puede copiar del ejercicio anterior o completar con el promedio real de los
// ultimos meses; en ambos casos solo se llenan las celdas vacias salvo que se pida reemplazar.
@Component({
  standalone: true,
  selector: 'app-finance-budget-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, GsPipe, NumPipe, FinanceBuildingPickerComponent, FinanceStateComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Presupuesto</h1>
            <p>Lo que se espera cobrar y gastar cada mes, por rubro. Se compara con lo real en «Presupuesto vs. real».</p>
          </div>
        </div>
        <div class="controls">
          <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-finance-building-picker>
          <label class="field" *ngIf="budget">
            <span>Ejercicio</span>
            <select [ngModel]="fiscalYear" (ngModelChange)="onYear($event)" [disabled]="dirty">
              <option *ngFor="let y of yearOptions" [ngValue]="y">{{ y }}</option>
            </select>
          </label>
        </div>
      </div>

      <app-finance-state [loading]="loading" [noBuilding]="noBuilding" [kind]="errorKind" [message]="errorMessage" [buildingId]="buildingId"></app-finance-state>

      <ng-container *ngIf="budget as b">
        <div class="actions" *ngIf="canEdit">
          <p-button type="button" label="Guardar cambios" icon="pi pi-check" [disabled]="!dirty" [loading]="saving" (onClick)="save()"></p-button>
          <p-button type="button" label="Descartar" severity="secondary" [outlined]="true" [disabled]="!dirty || saving" (onClick)="discard()"></p-button>
          <span class="sep"></span>
          <p-button type="button" label="Copiar del ejercicio anterior" icon="pi pi-copy" severity="secondary" [outlined]="true" [disabled]="dirty || saving" (onClick)="copyPrevious()"></p-button>
          <label class="inline">
            <select [(ngModel)]="averageMonths" [disabled]="dirty || saving">
              <option [ngValue]="3">3 meses</option>
              <option [ngValue]="6">6 meses</option>
              <option [ngValue]="12">12 meses</option>
            </select>
          </label>
          <p-button type="button" label="Completar con el promedio real" icon="pi pi-calculator" severity="secondary" [outlined]="true" [disabled]="dirty || saving" (onClick)="fillAverage()"></p-button>
          <label class="check"><input type="checkbox" [(ngModel)]="overwrite" /> <span>Reemplazar lo ya cargado</span></label>
        </div>
        <p-message *ngIf="!canEdit" severity="info" text="El presupuesto lo carga el Administrador de empresa; acá lo podés consultar."></p-message>
        <p class="muted small" *ngIf="canEdit && dirty">Hay cambios sin guardar. Guardalos o descartalos para cambiar de ejercicio o usar los atajos.</p>
        <p class="muted small">
          Ejercicio {{ b.fiscalYear }}: {{ b.fiscalYearStart | date: 'dd/MM/yyyy' }} al {{ b.fiscalYearEnd | date: 'dd/MM/yyyy' }}. Importes en guaraníes por mes. Los fondos no llevan presupuesto.
        </p>

        <div class="table-wrap">
          <table class="bg-table">
            <thead>
              <tr>
                <th class="sticky">Rubro</th>
                <th class="num" *ngFor="let m of b.months">{{ short(m.year, m.month) }}</th>
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              <ng-container *ngFor="let section of sections">
                <tr class="section"><td class="sticky" [attr.colspan]="b.months.length + 2">{{ section.label }}</td></tr>
                <ng-container *ngFor="let g of section.groups">
                  <tr class="group">
                    <td class="sticky"><code>{{ g.code }}</code> {{ g.name }}</td>
                    <td class="num" *ngFor="let m of b.months; let i = index">{{ groupMonth(g, i) | num }}</td>
                    <td class="num">{{ groupTotal(g) | num }}</td>
                  </tr>
                  <tr *ngFor="let r of g.rows; trackBy: trackRow" [class.inactive]="!r.isActive">
                    <td class="sticky child"><code>{{ r.code }}</code> {{ r.name }}</td>
                    <td class="num cell" *ngFor="let m of b.months; let i = index">
                      <input *ngIf="canEdit" type="number" min="0" step="1000" inputmode="numeric" [class.changed]="isChanged(r, i)"
                             [ngModel]="value(r, i)" (ngModelChange)="set(r, i, $event)" [attr.aria-label]="r.name + ' ' + short(m.year, m.month)" />
                      <span *ngIf="!canEdit">{{ value(r, i) ? (value(r, i) | num) : '' }}</span>
                    </td>
                    <td class="num">{{ rowTotal(r) | num }}</td>
                  </tr>
                </ng-container>
                <tr class="total">
                  <td class="sticky">Total {{ section.label.toLowerCase() }}</td>
                  <td class="num" *ngFor="let m of b.months; let i = index">{{ sectionMonth(section.type, i) | num }}</td>
                  <td class="num">{{ sectionTotal(section.type) | num }}</td>
                </tr>
              </ng-container>
              <tr class="total net">
                <td class="sticky">Resultado presupuestado (ingresos − gastos)</td>
                <td class="num" *ngFor="let m of b.months; let i = index" [class.neg]="resultMonth(i) < 0">{{ resultMonth(i) | num }}</td>
                <td class="num" [class.neg]="resultTotal() < 0">{{ resultTotal() | num }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted small">
          Gastos presupuestados del ejercicio: <strong>{{ sectionTotal('Expense') | gs }}</strong> · Ingresos presupuestados: <strong>{{ sectionTotal('Income') | gs }}</strong>.
          Los rubros propios se pueden presupuestar, pero su «real» queda en cero porque todavía no se les puede asignar categorías de gastos o ingresos.
        </p>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .controls { display: flex; gap: 1rem; align-items: end; flex-wrap: wrap; }
    .field { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .field select, .inline select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .actions { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.8rem; }
    .actions .sep { width: 1px; height: 1.8rem; background: var(--brand-border); margin: 0 0.3rem; }
    .check { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.88rem; color: var(--brand-ink-soft); }
    .muted { color: var(--brand-muted); }
    .small { font-size: 0.85rem; }
    .table-wrap { overflow-x: auto; margin: 1rem 0; border: 1px solid var(--brand-border); border-radius: 12px; }
    .bg-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 1250px; }
    .bg-table th, .bg-table td { padding: 0.3rem 0.45rem; border-bottom: 1px solid var(--brand-border); white-space: nowrap; }
    .bg-table th { text-align: left; color: var(--brand-muted); font-weight: 700; background: var(--p-content-background, #fff); }
    .num { text-align: right !important; }
    .sticky { position: sticky; left: 0; background: var(--p-content-background, #fff); min-width: 250px; z-index: 1; }
    .child { padding-left: 1.5rem !important; color: var(--brand-ink-soft); }
    .section td { background: var(--brand-gradient-soft); font-weight: 800; color: var(--brand-ink); }
    .section td.sticky { background: var(--brand-gradient-soft); }
    .group td { font-weight: 700; }
    .total td { font-weight: 800; border-top: 2px solid var(--brand-border); }
    .neg { color: #c9473b; }
    .inactive { opacity: 0.55; }
    .cell input {
      width: 86px; text-align: right; padding: 0.25rem 0.35rem; border: 1px solid transparent; border-radius: 6px;
      font: inherit; font-size: 0.85rem; color: var(--brand-ink); background: rgba(19,133,182,0.05);
    }
    .cell input:hover { border-color: rgba(19,133,182,0.3); }
    .cell input:focus { outline: none; border-color: var(--brand-c2); background: #fff; }
    .cell input.changed { background: rgba(224,165,38,0.18); border-color: rgba(224,165,38,0.6); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem; color: var(--brand-muted); }
  `]
})
export class FinanceBudgetPageComponent {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  buildingId = '';
  budget: FinanceBudget | null = null;
  // Valores que se estan editando (una fila por rubro, un importe por mes); `budget` conserva lo guardado.
  private working = new Map<string, number[]>();
  sections: { type: LedgerCategoryType; label: string; groups: BudgetGroup[] }[] = [];
  yearOptions: number[] = [];
  fiscalYear = 0;
  canEdit = false;
  loading = false;
  saving = false;
  noBuilding = false;
  errorKind: FinanceErrorKind | '' = '';
  errorMessage = '';
  averageMonths = 3;
  overwrite = false;

  get dirty(): boolean {
    return !!this.budget && this.budget.rows.some(r => r.amounts.some((v, i) => this.value(r, i) !== v));
  }

  onBuilding(building: FinanceBuildingAccess | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.fiscalYear = 0;
    this.budget = null;
    this.loading = true;

    // La pantalla necesita saber si el usuario puede editar y desde cuando existe el modulo (para los ejercicios).
    this.api.getSettings(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => {
        this.canEdit = settings.canEdit;
        const startYear = settings.financeStartDate ? Number(settings.financeStartDate.slice(0, 4)) : new Date().getFullYear();
        const years: number[] = [];
        for (let y = startYear - 1; y <= new Date().getFullYear() + 1; y++) years.push(y);
        this.yearOptions = years;
        this.load();
      },
      error: err => this.setError(err)
    });
  }

  onError(err: unknown): void { this.setError(err); }

  onYear(year: number): void {
    if (!year || year === this.fiscalYear || this.dirty) return;
    this.fiscalYear = year;
    this.load();
  }

  short(year: number, month: number): string { return monthShort(year, month); }
  trackRow(_: number, r: FinanceBudgetRow): string { return r.categoryId; }

  value(r: FinanceBudgetRow, i: number): number {
    return this.working.get(r.categoryId)?.[i] ?? r.amounts[i];
  }

  isChanged(r: FinanceBudgetRow, i: number): boolean { return this.value(r, i) !== r.amounts[i]; }

  set(r: FinanceBudgetRow, i: number, raw: number | string | null): void {
    const parsed = raw === null || raw === '' ? 0 : Math.max(0, Math.round(Number(raw)));
    const current = this.working.get(r.categoryId) ?? [...r.amounts];
    current[i] = Number.isFinite(parsed) ? parsed : 0;
    this.working.set(r.categoryId, current);
    this.cdr.markForCheck();
  }

  rowTotal(r: FinanceBudgetRow): number { return r.amounts.reduce((sum, _, i) => sum + this.value(r, i), 0); }
  groupMonth(g: BudgetGroup, i: number): number { return g.rows.reduce((sum, r) => sum + this.value(r, i), 0); }
  groupTotal(g: BudgetGroup): number { return g.rows.reduce((sum, r) => sum + this.rowTotal(r), 0); }

  sectionMonth(type: LedgerCategoryType, i: number): number {
    return (this.budget?.rows ?? []).filter(r => r.type === type).reduce((sum, r) => sum + this.value(r, i), 0);
  }

  sectionTotal(type: LedgerCategoryType): number {
    return (this.budget?.rows ?? []).filter(r => r.type === type).reduce((sum, r) => sum + this.rowTotal(r), 0);
  }

  resultMonth(i: number): number { return this.sectionMonth('Income', i) - this.sectionMonth('Expense', i); }
  resultTotal(): number { return this.sectionTotal('Income') - this.sectionTotal('Expense'); }

  discard(): void {
    this.working.clear();
    this.cdr.markForCheck();
  }

  save(): void {
    if (!this.budget || this.saving || !this.dirty) return;
    const b = this.budget;
    const cells: FinanceBudgetCell[] = [];
    for (const r of b.rows) {
      r.amounts.forEach((original, i) => {
        const now = this.value(r, i);
        if (now !== original) cells.push({ categoryId: r.categoryId, year: b.months[i].year, month: b.months[i].month, amount: now });
      });
    }

    this.saving = true;
    this.api.updateBudget(this.buildingId, b.fiscalYear, cells).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.saving = false;
        this.apply(result);
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Presupuesto guardado (${result.affectedCells} celdas).`, life: 4000 });
        this.cdr.markForCheck();
      },
      error: err => this.toastError(err, 'No se pudo guardar el presupuesto.')
    });
  }

  copyPrevious(): void {
    if (!this.budget || this.saving || this.dirty) return;
    this.saving = true;
    this.api.copyPreviousBudget(this.buildingId, this.budget.fiscalYear, this.overwrite).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => this.afterBulk(result, 'del ejercicio anterior'),
      error: err => this.toastError(err, 'No se pudo copiar el presupuesto.')
    });
  }

  fillAverage(): void {
    if (!this.budget || this.saving || this.dirty) return;
    this.saving = true;
    this.api.fillBudgetFromAverage(this.buildingId, this.budget.fiscalYear, this.averageMonths, this.overwrite).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => this.afterBulk(result, `del promedio real de los últimos ${this.averageMonths} meses`),
      error: err => this.toastError(err, 'No se pudo completar con el promedio.')
    });
  }

  private afterBulk(result: FinanceBudget, origin: string): void {
    this.saving = false;
    this.apply(result);
    this.msg.add({
      severity: result.affectedCells ? 'success' : 'info',
      summary: result.affectedCells ? 'Presupuesto actualizado' : 'Sin cambios',
      detail: result.affectedCells ? `Se cargaron ${result.affectedCells} celdas a partir ${origin}.` : `No había celdas para completar a partir ${origin}.`,
      life: 5000
    });
    this.cdr.markForCheck();
  }

  private load(): void {
    this.loading = true;
    this.errorKind = '';
    this.api.getBudget(this.buildingId, this.fiscalYear || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.loading = false;
        this.apply(result);
        this.cdr.markForCheck();
      },
      error: err => this.setError(err)
    });
  }

  private apply(result: FinanceBudget): void {
    this.budget = result;
    this.fiscalYear = result.fiscalYear;
    this.working.clear();
    this.sections = this.buildSections(result);
  }

  private buildSections(b: FinanceBudget): { type: LedgerCategoryType; label: string; groups: BudgetGroup[] }[] {
    const make = (type: LedgerCategoryType, label: string) => {
      const groups = new Map<string, BudgetGroup>();
      for (const row of b.rows.filter(r => r.type === type)) {
        const key = row.groupCode || row.code;
        let g = groups.get(key);
        if (!g) {
          g = { code: row.groupCode || row.code, name: row.groupName || row.name, rows: [] };
          groups.set(key, g);
        }

        g.rows.push(row);
      }

      return { type, label, groups: [...groups.values()].sort((a, c) => a.code.localeCompare(c.code)) };
    };

    return [make('Income', 'Ingresos'), make('Expense', 'Gastos')].filter(s => s.groups.length > 0);
  }

  private toastError(err: unknown, fallback: string): void {
    this.saving = false;
    this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, fallback), life: 6000 });
    this.cdr.markForCheck();
  }

  private setError(err: unknown): void {
    const { kind, message } = classifyFinanceError(err, 'No se pudo cargar el presupuesto.');
    this.budget = null;
    this.loading = false;
    this.errorKind = kind;
    this.errorMessage = message;
    this.cdr.markForCheck();
  }
}
