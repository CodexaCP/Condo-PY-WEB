import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { FinanceApiService } from '../../api/finance-api.service';
import { BuildingExpenseCategory, BuildingIncomeCategory, LedgerCategoryType, LedgerPlanApplyMode, LedgerPlanApplyResult, LedgerPlanImportPreview, LedgerPlanImportRow } from '../../api/models';
import {
  EXPENSE_CATEGORY_CHOICES, EXPENSE_CATEGORY_LABELS, INCOME_CATEGORY_CHOICES, INCOME_CATEGORY_LABELS,
  LEDGER_TYPE_LABELS, LEDGER_TYPE_ORDER, roleLabel
} from './finance-format';

// Importa el plan de cuentas del cliente desde un Excel: 1) se elige el archivo y se lee (no se guarda nada); 2) se revisa el árbol
// resuelto —el tipo de las cuentas de primer nivel y la categoría con la que cuenta en la liquidación cada cuenta final de ingresos o
// egresos se pueden corregir— y 3) se confirma, reemplazando el plan del edificio o agregando/actualizando por código. El servidor
// vuelve a validar todo al confirmar. Los errores del archivo se corrigen en el Excel y se vuelve a cargar.
@Component({
  standalone: true,
  selector: 'app-finance-plan-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Message],
  template: `
    <div class="ov-backdrop" (click)="close()"></div>
    <div class="ov-panel" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Importar el plan de cuentas del cliente</strong>
        <button class="ov-close" type="button" (click)="close()">✕</button>
      </div>

      <ng-container *ngIf="!preview">
        <p class="confirm-text">
          Cargá el Excel (.xlsx) con las cuentas del cliente. Solo hacen falta el <strong>código</strong> y el <strong>nombre</strong>; el grupo
          de cada cuenta se deduce por el código (5.02.01 queda dentro de 5.02) y el tipo, por el primer número (1 Activo, 2 Pasivo, 3 Patrimonio,
          4 Ingresos, 5 Egresos). En el paso siguiente revisás todo antes de guardar.
        </p>
        <p><a href="#" (click)="downloadTemplate($event)">Descargar plantilla de ejemplo (.xlsx)</a></p>
        <label class="file">
          <span>Archivo Excel</span>
          <input type="file" accept=".xlsx" (change)="onFile($event)" />
        </label>
        <p-message *ngIf="error" severity="error" [text]="error"></p-message>
        <div class="confirm-footer">
          <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="close()"></p-button>
          <p-button label="Leer archivo" icon="pi pi-upload" [loading]="reading" [disabled]="!file" (onClick)="read()"></p-button>
        </div>
      </ng-container>

      <ng-container *ngIf="preview as p">
        <div class="summary">
          <span><strong>{{ rows.length }}</strong> filas · <strong>{{ leafCount }}</strong> cuentas finales · <strong>{{ rows.length - leafCount }}</strong> grupos</span>
          <span class="bad" *ngIf="p.errorCount"><strong>{{ p.errorCount }}</strong> errores</span>
          <span class="warn" *ngIf="p.warningCount"><strong>{{ p.warningCount }}</strong> avisos</span>
          <label class="check small"><input type="checkbox" [(ngModel)]="onlyIssues" name="onlyIssues" /><span>Ver solo filas con errores o avisos</span></label>
        </div>

        <p-message *ngIf="p.hasErrors" severity="error" styleClass="block">
          El archivo tiene errores: corregilos en el Excel y volvé a cargarlo. No se puede importar hasta que no haya errores.
        </p-message>

        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Fila</th><th>Código</th><th>Nombre</th><th>Tipo</th><th>En la liquidación cuenta como</th><th>Usar</th><th>Revisar</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let r of visibleRows; trackBy: trackRow" [class.has-error]="r.errors.length" [class.group]="!r.isLeaf">
                <td class="num">{{ r.rowNumber }}</td>
                <td class="code"><span [style.padding-left.px]="(r.level - 1) * 14">{{ r.code }}</span></td>
                <td>{{ r.name }}</td>
                <td>
                  <select *ngIf="!r.parentCode" [ngModel]="r.type" (ngModelChange)="setRootType(r, $event)" [name]="'t' + r.rowNumber">
                    <option *ngFor="let t of typeOrder" [value]="t">{{ typeLabel(t) }}</option>
                  </select>
                  <span *ngIf="r.parentCode" class="muted">{{ typeLabel(r.type) }}</span>
                </td>
                <td>
                  <ng-container *ngIf="r.isLeaf && r.type === 'Expense'">
                    <select [(ngModel)]="r.expenseCategory" [name]="'e' + r.rowNumber" (ngModelChange)="r.categorySuggested = false">
                      <option *ngFor="let c of expenseChoices" [value]="c">{{ expenseLabel(c) }}</option>
                    </select>
                    <small class="sug" *ngIf="r.categorySuggested">sugerida</small>
                  </ng-container>
                  <ng-container *ngIf="r.isLeaf && r.type === 'Income'">
                    <select [(ngModel)]="r.incomeCategory" [name]="'i' + r.rowNumber" (ngModelChange)="r.categorySuggested = false">
                      <option *ngFor="let c of incomeChoices" [value]="c">{{ incomeLabel(c) }}</option>
                    </select>
                    <small class="sug" *ngIf="r.categorySuggested">sugerida</small>
                  </ng-container>
                  <span class="muted" *ngIf="r.systemKey">{{ role(r.systemKey) }}</span>
                  <a href="#" class="quit" *ngIf="r.systemKey" (click)="clearRole($event, r)">quitar</a>
                  <span class="muted" *ngIf="!r.isLeaf">Grupo</span>
                  <span class="muted" *ngIf="r.isLeaf && r.type !== 'Expense' && r.type !== 'Income'">De referencia</span>
                </td>
                <td class="center"><input *ngIf="r.isLeaf" type="checkbox" [(ngModel)]="r.isActive" [name]="'a' + r.rowNumber" /></td>
                <td class="issues">
                  <div *ngFor="let e of r.errors" class="bad">{{ e }}</div>
                  <div *ngFor="let w of r.warnings" class="warn">{{ w }}</div>
                </td>
              </tr>
              <tr *ngIf="!visibleRows.length"><td colspan="7" class="center muted">Ninguna fila para mostrar.</td></tr>
            </tbody>
          </table>
        </div>

        <fieldset class="mode" *ngIf="!p.hasErrors">
          <label class="radio">
            <input type="radio" name="mode" value="Replace" [(ngModel)]="mode" />
            <span><strong>Reemplazar el plan del edificio</strong><small>El plan actual se sustituye por este (recomendado para el plan del cliente).</small></span>
          </label>
          <label class="radio">
            <input type="radio" name="mode" value="Update" [(ngModel)]="mode" />
            <span><strong>Agregar y actualizar por código</strong><small>Suma las cuentas nuevas y actualiza nombre, código del contador, estado y categoría de las que ya existen. No borra nada.</small></span>
          </label>
          <p-message *ngIf="mode === 'Replace'" severity="warn" styleClass="block">
            <div>
              Se reemplazan <strong>{{ p.impact.categories }}</strong> cuentas.
              <span *ngIf="!p.impact.hasImpact">No hay gastos, ingresos ni presupuesto que dependan de ellas.</span>
              <ul *ngIf="p.impact.hasImpact">
                <li *ngIf="p.impact.expenses"><strong>{{ p.impact.expenses }}</strong> gastos quedan sin rubro (siguen cargados).</li>
                <li *ngIf="p.impact.incomes"><strong>{{ p.impact.incomes }}</strong> ingresos quedan sin rubro.</li>
                <li *ngIf="p.impact.recurringExpenses"><strong>{{ p.impact.recurringExpenses }}</strong> plantillas recurrentes quedan sin rubro.</li>
                <li *ngIf="p.impact.budgetLines"><strong>{{ p.impact.budgetLines }}</strong> renglones de presupuesto se borran.</li>
              </ul>
            </div>
          </p-message>
          <label class="check" *ngIf="mode === 'Replace' && p.impact.hasImpact">
            <input type="checkbox" [(ngModel)]="confirmReplace" name="confirmReplace" />
            <span>Entiendo que se pierde esto y quiero reemplazar el plan.</span>
          </label>
        </fieldset>

        <p-message *ngIf="error" severity="error" [text]="error"></p-message>
        <div class="confirm-footer">
          <p-button label="Elegir otro archivo" severity="secondary" [outlined]="true" (onClick)="reset()" [disabled]="saving"></p-button>
          <p-button label="Importar plan" icon="pi pi-check" [loading]="saving" [disabled]="!canImport" (onClick)="commit()"></p-button>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.45); z-index: 1000; backdrop-filter: blur(2px); }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(1100px, calc(100vw - 2rem)); max-height: 92vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001; box-shadow: 0 32px 80px rgba(15,40,60,0.28); padding: 1.6rem;
    }
    .ov-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(19,133,182,0.1); }
    .ov-header strong { font-size: 1.2rem; color: var(--brand-ink); }
    .ov-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%; }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .confirm-text { margin: 0 0 0.8rem; color: var(--brand-ink); line-height: 1.6; }
    .file { display: block; margin: 0.8rem 0; }
    .file > span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); display: block; margin-bottom: 0.25rem; }
    .summary { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.7rem; color: var(--brand-ink); }
    .bad { color: #b91c1c; }
    .warn { color: #b45309; }
    .muted { color: var(--brand-muted); }
    .check { display: flex; gap: 0.5rem; align-items: flex-start; margin-top: 0.7rem; color: var(--brand-ink); }
    .check.small { margin: 0 0 0 auto; font-size: 0.85rem; align-items: center; }
    .table-wrap { max-height: 46vh; overflow: auto; border: 1px solid rgba(19,133,182,0.18); border-radius: 12px; margin: 0.6rem 0; }
    table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
    th { position: sticky; top: 0; background: #f1f6fa; text-align: left; padding: 0.45rem 0.6rem; z-index: 1; }
    td { padding: 0.35rem 0.6rem; border-top: 1px solid rgba(19,133,182,0.1); vertical-align: top; }
    tr.group td { background: rgba(19,133,182,0.04); font-weight: 600; }
    tr.has-error td { background: rgba(185,28,28,0.06); }
    td.num, td.code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
    td.center { text-align: center; }
    td.issues { min-width: 240px; font-size: 0.8rem; }
    select { padding: 0.25rem 0.4rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 8px; font: inherit; max-width: 100%; }
    .sug { color: var(--brand-muted); margin-left: 0.3rem; }
    .quit { margin-left: 0.4rem; font-size: 0.8rem; }
    .mode { border: 0; padding: 0; margin: 0.6rem 0 0; }
    .radio { display: flex; gap: 0.7rem; align-items: flex-start; padding: 0.6rem 0.9rem; border: 1px solid rgba(19,133,182,0.2); border-radius: 12px; margin-bottom: 0.5rem; cursor: pointer; }
    .radio span { display: grid; gap: 0.15rem; }
    .radio small { color: var(--brand-muted); line-height: 1.4; }
    .radio input { margin-top: 0.25rem; }
    :host ::ng-deep .block ul { margin: 0.4rem 0 0; padding-left: 1.1rem; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class FinancePlanImportComponent {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() applied = new EventEmitter<LedgerPlanApplyResult>();

  readonly typeOrder = LEDGER_TYPE_ORDER;
  readonly expenseChoices = EXPENSE_CATEGORY_CHOICES;
  readonly incomeChoices = INCOME_CATEGORY_CHOICES;

  file: File | null = null;
  reading = false;
  saving = false;
  error = '';
  preview: LedgerPlanImportPreview | null = null;
  rows: LedgerPlanImportRow[] = [];
  mode: LedgerPlanApplyMode = 'Replace';
  confirmReplace = false;
  onlyIssues = false;

  typeLabel(t: LedgerCategoryType): string { return LEDGER_TYPE_LABELS[t] ?? t; }
  expenseLabel(c: BuildingExpenseCategory): string { return EXPENSE_CATEGORY_LABELS[c] ?? c; }
  incomeLabel(c: BuildingIncomeCategory): string { return INCOME_CATEGORY_LABELS[c] ?? c; }
  role(key: string | null): string { return roleLabel(key) || (key ?? ''); }
  trackRow(_: number, r: LedgerPlanImportRow): number { return r.rowNumber; }

  get leafCount(): number { return this.rows.filter(r => r.isLeaf).length; }
  get visibleRows(): LedgerPlanImportRow[] {
    return this.onlyIssues ? this.rows.filter(r => r.errors.length || r.warnings.length) : this.rows;
  }

  get canImport(): boolean {
    const p = this.preview;
    if (!p || p.hasErrors || !this.rows.length || this.saving) return false;
    return this.mode !== 'Replace' || !p.impact.hasImpact || this.confirmReplace;
  }

  close(): void { if (!this.saving && !this.reading) this.closed.emit(); }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
    this.error = '';
    this.cdr.markForCheck();
  }

  downloadTemplate(event: Event): void {
    event.preventDefault();
    this.api.downloadPlanImportTemplate(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plan-de-cuentas-plantilla.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: err => { this.error = extractApiErrorMessage(err, 'No se pudo descargar la plantilla.'); this.cdr.markForCheck(); }
    });
  }

  read(): void {
    if (!this.file || this.reading) return;
    this.reading = true;
    this.error = '';
    this.api.previewPlanImport(this.buildingId, this.file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: preview => {
        this.reading = false;
        this.preview = preview;
        this.rows = preview.rows;
        this.confirmReplace = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.reading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo leer el archivo.');
        this.cdr.markForCheck();
      }
    });
  }

  // Quita la función de cobranza que el sistema sugirió por el nombre: la cuenta pasa a ser un ingreso común (categoría «Otro»).
  clearRole(event: Event, row: LedgerPlanImportRow): void {
    event.preventDefault();
    row.systemKey = null;
    if (row.type === 'Income') row.incomeCategory = 'Other';
    row.categorySuggested = false;
    this.cdr.markForCheck();
  }

  reset(): void {
    this.preview = null;
    this.rows = [];
    this.file = null;
    this.error = '';
    this.cdr.markForCheck();
  }

  // El tipo se define en las cuentas de primer nivel: todo lo que cuelga de ellas lo hereda. Al cambiarlo, las categorías de la
  // liquidación de las cuentas finales de ese árbol se reinician (las de gastos no sirven para ingresos y al revés).
  setRootType(root: LedgerPlanImportRow, type: LedgerCategoryType): void {
    root.type = type;
    const children = new Map<string, LedgerPlanImportRow[]>();
    for (const r of this.rows) {
      if (r.parentCode) {
        const list = children.get(r.parentCode) ?? [];
        list.push(r);
        children.set(r.parentCode, list);
      }
    }

    const walk = (code: string) => {
      for (const child of children.get(code) ?? []) {
        child.type = type;
        if (child.isLeaf) {
          child.expenseCategory = type === 'Expense' ? (child.expenseCategory ?? 'Other') : null;
          child.incomeCategory = type === 'Income' ? (child.incomeCategory ?? 'Other') : null;
          child.systemKey = null;
        }

        walk(child.code);
      }
    };

    if (root.isLeaf) {
      root.expenseCategory = type === 'Expense' ? (root.expenseCategory ?? 'Other') : null;
      root.incomeCategory = type === 'Income' ? (root.incomeCategory ?? 'Other') : null;
      root.systemKey = null;
    }

    walk(root.code);
    this.cdr.markForCheck();
  }

  commit(): void {
    if (!this.canImport) return;
    this.saving = true;
    this.error = '';
    this.api.commitPlanImport({ buildingId: this.buildingId, mode: this.mode, confirmReplace: this.confirmReplace, rows: this.rows })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => { this.saving = false; this.applied.emit(result); },
        error: err => { this.saving = false; this.error = extractApiErrorMessage(err, 'No se pudo importar el plan.'); this.cdr.markForCheck(); }
      });
  }
}
