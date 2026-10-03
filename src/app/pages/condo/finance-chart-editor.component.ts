import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { FinanceAccessService } from '../../api/finance-access.service';
import { FinanceApiService } from '../../api/finance-api.service';
import { BuildingExpenseCategory, BuildingIncomeCategory, LedgerCategory, LedgerCategoryCopyResult, LedgerCategoryType, LedgerPlanApplyResult } from '../../api/models';
import { FinanceExportButtonComponent } from './finance-export-button.component';
import { FinancePlanImportComponent } from './finance-plan-import.component';
import { FinancePlanTemplateComponent } from './finance-plan-template.component';
import {
  EXPENSE_CATEGORY_CHOICES, EXPENSE_CATEGORY_LABELS, INCOME_CATEGORY_CHOICES, INCOME_CATEGORY_LABELS,
  LEDGER_ROLES, LEDGER_TYPE_LABELS, LEDGER_TYPE_ORDER, LedgerRoleChoice, MOVEMENT_TYPES, roleLabel
} from './finance-format';

// Una fila del árbol, con su nivel (0 = clase) y si se puede abrir o cerrar.
interface TreeRow {
  item: LedgerCategory;
  depth: number;
  expandable: boolean;
  expanded: boolean;
}

// Plan de cuentas del edificio: clase → grupo → cuenta (hasta 6 niveles) con códigos editables. Nace del plan genérico de CondoPY y el
// SuperAdmin lo ajusta: activa las cuentas que el edificio usa, agrega las propias, importa el plan del cliente desde Excel, copia el de otro
// edificio o vuelve a aplicar el genérico. Solo las cuentas finales de ingresos y egresos reciben gastos e ingresos; el resto (activo,
// pasivo, patrimonio y los grupos) es de referencia y se exporta al contador. Una cuenta puede tener una función especial: cobranza de
// expensas o cuenta por defecto de una categoría. Una cuenta con gastos o ingresos cargados solo se desactiva.
@Component({
  standalone: true,
  selector: 'app-finance-chart-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Message, Tag, FinanceExportButtonComponent, FinancePlanImportComponent, FinancePlanTemplateComponent],
  template: `
    <div class="intro">
      <p>
        El plan ordena los ingresos y gastos del edificio: al cargar un gasto o un ingreso se elige una de las <strong>cuentas activas</strong>. Tildá <strong>Usar</strong> en las cuentas que el edificio necesita
        (en un grupo, activa o desactiva todo lo que contiene). El <strong>código</strong> sirve para exportar los datos al contador y el <strong>código del contador</strong> (opcional) mapea cada cuenta a su plan.
        Las clases de activo, pasivo y patrimonio son de referencia: no reciben movimientos.
      </p>
      <div class="intro-actions">
        <app-finance-export-button kind="chart" [buildingId]="buildingId" fileLabel="plan-de-cuentas" [period]="today" [disabled]="!canExport"
                                   disabledHint="Completá la configuración inicial para exportar el plan."></app-finance-export-button>
        <p-button *ngIf="canEdit" type="button" label="Plan genérico" icon="pi pi-list" severity="secondary" [outlined]="true" (onClick)="templateVisible = true"></p-button>
        <p-button *ngIf="canEdit" type="button" label="Importar plan del cliente" icon="pi pi-file-excel" severity="secondary" [outlined]="true" (onClick)="importVisible = true"></p-button>
        <p-button *ngIf="canEdit" type="button" label="Copiar de otro edificio" icon="pi pi-copy" severity="secondary" [outlined]="true" (onClick)="openCopy()"></p-button>
        <p-button *ngIf="canEdit" type="button" label="Nueva cuenta" icon="pi pi-plus" (onClick)="openCreate()"></p-button>
      </div>
    </div>

    <p-message *ngIf="planResult as r" severity="success" styleClass="copy-result">
      <div>
        <strong>Plan aplicado:</strong> {{ r.created }} cuentas creadas<span *ngIf="r.updated">, {{ r.updated }} actualizadas</span><span *ngIf="r.skipped">, {{ r.skipped }} sin agregar</span>.
        <span *ngIf="r.removedCategories">Se reemplazaron {{ r.removedCategories }} cuentas del plan anterior.</span>
        <span *ngIf="r.unlinkedExpenses || r.unlinkedIncomes || r.unlinkedRecurringExpenses">
          Quedaron sin rubro: {{ r.unlinkedExpenses }} gastos, {{ r.unlinkedIncomes }} ingresos y {{ r.unlinkedRecurringExpenses }} plantillas recurrentes.
        </span>
        <span *ngIf="r.deletedBudgetLines">Se borraron {{ r.deletedBudgetLines }} renglones de presupuesto.</span>
        <ul *ngIf="r.messages.length"><li *ngFor="let m of r.messages">{{ m }}</li></ul>
      </div>
    </p-message>

    <p-message *ngIf="copyResult as r" severity="success" styleClass="copy-result">
      <div>
        <strong>Plan copiado:</strong> {{ r.created }} cuentas creadas, {{ r.updated }} actualizadas<span *ngIf="r.skipped">, {{ r.skipped }} sin copiar</span>.
        <ul *ngIf="r.messages.length"><li *ngFor="let m of r.messages">{{ m }}</li></ul>
      </div>
    </p-message>

    <p-message *ngIf="missingCollection.length" severity="warn" styleClass="copy-result">
      <div>
        <strong>Faltan cuentas de cobranza.</strong> Estas funciones no están asignadas a ninguna cuenta:
        <ul><li *ngFor="let m of missingCollection">{{ m }}</li></ul>
        <span>Mientras tanto los reportes las muestran como líneas sin código. {{ canEdit ? 'Asignalas editando la cuenta que corresponda (campo «Función en el sistema»).' : 'Pedí a tu administrador de CondoPY que las asigne.' }}</span>
      </div>
    </p-message>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading">Cargando plan de cuentas...</p>
    <p class="app-state" *ngIf="!loading && !error && !items.length">El plan de cuentas está vacío. {{ canEdit ? 'Aplicá el plan genérico o importá el del cliente.' : '' }}</p>

    <div class="toolbar" *ngIf="items.length">
      <input class="search" type="search" [(ngModel)]="search" (ngModelChange)="rebuild()" name="chartSearch" placeholder="Buscar por código o nombre..." />
      <label class="check"><input type="checkbox" [(ngModel)]="onlyActive" (ngModelChange)="rebuild()" name="onlyActive" /><span>Solo activas</span></label>
      <p-button type="button" label="Expandir todo" severity="secondary" [text]="true" size="small" (onClick)="expandAll()"></p-button>
      <p-button type="button" label="Colapsar todo" severity="secondary" [text]="true" size="small" (onClick)="collapseAll()"></p-button>
      <span class="count">{{ activeCount }} de {{ items.length }} activas</span>
    </div>

    <div class="app-list tree" *ngIf="rows.length">
      <div class="app-row cat-grid tree-row" *ngFor="let row of rows; trackBy: trackRow"
           [class.group-row]="row.item.hasChildren" [class.root-row]="row.depth === 0" [class.inactive]="!row.item.isActive">
        <span class="code-cell" [style.padding-left.rem]="row.depth * 1.15">
          <button type="button" class="chev" *ngIf="row.expandable" (click)="toggle(row.item)" [attr.aria-label]="row.expanded ? 'Cerrar' : 'Abrir'">
            <i class="pi" [ngClass]="row.expanded ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
          </button>
          <span class="chev-space" *ngIf="!row.expandable"></span>
          <code>{{ row.item.code }}</code>
        </span>
        <span class="child-name">
          <span class="child-text">
            <span [class.strong]="row.item.hasChildren">{{ row.item.name }}</span>
            <small class="liq" *ngIf="categoryText(row.item) as liq">En la liquidación: {{ liq }}</small>
            <small class="liq" *ngIf="!row.item.hasChildren && row.item.parentId && !isMovementType(row.item.type)">De referencia: no recibe gastos ni ingresos</small>
          </span>
          <p-tag *ngIf="row.item.systemKey" [value]="roleText(row.item.systemKey)" severity="info" styleClass="tag-sm"></p-tag>
          <p-tag *ngIf="row.item.hasMovements" value="Con movimientos" severity="secondary" styleClass="tag-sm"></p-tag>
        </span>
        <span class="ext">{{ row.item.externalCode || '—' }}</span>
        <span class="use">
          <label class="use-check" *ngIf="canEdit">
            <input type="checkbox" [checked]="row.item.isActive" (change)="setActive(row.item, $any($event.target).checked)" [disabled]="busyId === row.item.id" />
            <span>Usar</span>
          </label>
          <p-tag *ngIf="!canEdit" [value]="row.item.isActive ? 'Activa' : 'Inactiva'" [severity]="row.item.isActive ? 'success' : 'secondary'"></p-tag>
        </span>
        <div class="app-actions" *ngIf="canEdit">
          <p-button type="button" icon="pi pi-plus" severity="secondary" [rounded]="true" [text]="true" (onClick)="openCreate(row.item)" aria-label="Agregar subcuenta" title="Agregar subcuenta"></p-button>
          <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="openEdit(row.item)" aria-label="Editar"></p-button>
          <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" (onClick)="askDelete(row.item)"
                    [disabled]="row.item.isTemplate || row.item.hasChildren || row.item.hasMovements" aria-label="Eliminar"
                    [title]="deleteHint(row.item)"></p-button>
        </div>
        <span *ngIf="!canEdit"></span>
      </div>
    </div>
    <p class="app-state" *ngIf="items.length && !rows.length">Ninguna cuenta coincide con la búsqueda.</p>

    <div class="ov-backdrop" *ngIf="formVisible" (click)="closeForm()"></div>
    <div class="ov-panel" *ngIf="formVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ editing ? 'Editar cuenta' : 'Nueva cuenta' }}</strong>
        <button class="ov-close" type="button" (click)="closeForm()">✕</button>
      </div>
      <form class="ficha-form" (ngSubmit)="save()">
        <p class="note" *ngIf="editing?.isTemplate">
          Cuenta con función especial: se puede renombrar, recodificar y desactivar, pero no mover, cambiar de tipo ni eliminar.
        </p>
        <label>
          <span>Grupo (padre)</span>
          <select [(ngModel)]="form.parentId" name="parentId" [disabled]="lockedPlacement" (ngModelChange)="onParentChange()">
            <option [ngValue]="null">— Ninguno: es una clase (primer nivel) —</option>
            <option *ngFor="let g of parentOptions" [ngValue]="g.id">{{ g.label }}</option>
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select [(ngModel)]="form.type" name="type" [disabled]="lockedPlacement || !!form.parentId">
            <option *ngFor="let t of typeOrder" [value]="t">{{ typeLabel(t) }}</option>
          </select>
        </label>
        <p class="note" *ngIf="editing?.hasMovements">
          Esta cuenta ya tiene gastos o ingresos cargados: no se puede eliminar ni cambiar de tipo o de categoría. Si ya no se usa, desactivala.
        </p>
        <label *ngIf="canHaveRole">
          <span>Función en el sistema</span>
          <select [(ngModel)]="form.systemKey" name="systemKey" (ngModelChange)="onRoleChange()" [disabled]="roleLocked">
            <option value="">Ninguna</option>
            <option *ngFor="let r of roleOptions" [value]="r.key">{{ r.label }}</option>
          </select>
          <small class="hint" *ngIf="roleLocked">Las cuentas de cobranza no se pueden dejar sin función: para cambiarla, asignala a otra cuenta.</small>
          <small class="hint" *ngIf="!roleLocked">Opcional. «Cobranza…» recibe lo que pagan los propietarios; «Cuenta por defecto…» recibe los gastos o ingresos que se cargan sin elegir cuenta. Si otra cuenta ya tenía la función, se la quita.</small>
        </label>
        <label *ngIf="showCategory">
          <span>En la liquidación cuenta como</span>
          <select *ngIf="form.type === 'Expense'" [(ngModel)]="form.expenseCategory" name="expenseCategory" [disabled]="!!editing?.hasMovements || roleFixesCategory">
            <option *ngFor="let c of expenseChoices" [value]="c">{{ expenseLabel(c) }}</option>
          </select>
          <select *ngIf="form.type === 'Income'" [(ngModel)]="form.incomeCategory" name="incomeCategory" [disabled]="!!editing?.hasMovements || roleFixesCategory">
            <option *ngFor="let c of incomeChoices" [value]="c">{{ incomeLabel(c) }}</option>
          </select>
          <small class="hint" *ngIf="roleFixesCategory">Lo fija la función elegida.</small>
          <small class="hint" *ngIf="!roleFixesCategory">Los gastos o ingresos que se carguen en esta cuenta se agrupan en la liquidación con esta categoría.</small>
        </label>
        <label>
          <span>Código <span class="req">*</span></span>
          <input [(ngModel)]="form.code" name="code" required maxlength="30" placeholder="Ej.: 5.03.15" />
        </label>
        <label>
          <span>Nombre <span class="req">*</span></span>
          <input [(ngModel)]="form.name" name="name" required maxlength="200" />
        </label>
        <label>
          <span>Código del contador (opcional)</span>
          <input [(ngModel)]="form.externalCode" name="externalCode" maxlength="50" />
        </label>
        <label class="checkbox">
          <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" />
          <span>Cuenta activa</span>
        </label>
        <div class="ficha-footer">
          <p-button type="button" label="Cancelar" severity="secondary" [outlined]="true" (onClick)="closeForm()"></p-button>
          <p-button type="submit" [loading]="saving" [label]="editing ? 'Guardar cambios' : 'Crear cuenta'"></p-button>
        </div>
      </form>
    </div>

    <div class="ov-backdrop" *ngIf="copyVisible" (click)="closeCopy()"></div>
    <div class="ov-panel ov-panel-sm" *ngIf="copyVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Copiar plan de cuentas</strong>
        <button class="ov-close" type="button" (click)="closeCopy()">✕</button>
      </div>
      <p class="confirm-text">
        Se copian los nombres, códigos del contador, cuentas activas y funciones de otro edificio, y se crean las cuentas que falten. No se borra nada de este
        edificio ni se tocan sus gastos, ingresos o presupuesto.
      </p>
      <p class="note" *ngIf="!sourceOptions.length">No hay otro edificio con Finanzas habilitado para copiar.</p>
      <label class="copy-field" *ngIf="sourceOptions.length">
        <span>Copiar desde</span>
        <select [(ngModel)]="copySourceId" name="copySourceId">
          <option value="">— Elegí un edificio —</option>
          <option *ngFor="let b of sourceOptions" [value]="b.buildingId">{{ b.buildingName }}</option>
        </select>
      </label>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="closeCopy()"></p-button>
        <p-button label="Copiar" icon="pi pi-copy" [loading]="copying" [disabled]="!copySourceId" (onClick)="confirmCopy()"></p-button>
      </div>
    </div>

    <app-finance-plan-template *ngIf="templateVisible" [buildingId]="buildingId" (closed)="templateVisible = false" (applied)="onPlanApplied($event)"></app-finance-plan-template>
    <app-finance-plan-import *ngIf="importVisible" [buildingId]="buildingId" (closed)="importVisible = false" (applied)="onPlanApplied($event)"></app-finance-plan-import>

    <div class="ov-backdrop ov-backdrop-top" *ngIf="deleteTarget" (click)="cancelDelete()"></div>
    <div class="ov-panel ov-panel-sm" *ngIf="deleteTarget" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Eliminar cuenta</strong>
        <button class="ov-close" type="button" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">¿Eliminar la cuenta <strong>{{ deleteTarget.code }} · {{ deleteTarget.name }}</strong>?</p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar" severity="danger" [loading]="saving" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .intro { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .intro p { margin: 0; max-width: 66ch; color: var(--brand-ink-soft); line-height: 1.5; }
    .intro-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .toolbar { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin: 0.75rem 0; }
    .search { flex: 1 1 240px; max-width: 360px; padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px; font: inherit; }
    .check, .use-check { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--brand-ink); font-size: 0.9rem; }
    .count { margin-left: auto; color: var(--brand-muted); font-size: 0.85rem; }
    .child-text { display: grid; gap: 0.1rem; }
    .strong { font-weight: 700; }
    .liq, .hint { color: var(--brand-muted); font-size: 0.78rem; }
    .hint { display: block; margin-top: 0.3rem; }
    .copy-field { display: block; }
    .copy-field > span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); display: block; margin-bottom: 0.25rem; }
    .copy-field select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px; font: inherit; }
    :host ::ng-deep .copy-result ul { margin: 0.4rem 0 0; padding-left: 1.1rem; }
    .app-list { gap: 0.3rem; }
    .cat-grid { grid-template-columns: minmax(150px, 1.2fr) 4fr 1.1fr 0.9fr 1.3fr; padding: 0.5rem 1rem; align-items: center; }
    .group-row { background: var(--brand-gradient-soft); }
    .root-row { background: rgba(19,133,182,0.14); }
    .child-name { display: inline-flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .code-cell { display: inline-flex; align-items: center; gap: 0.3rem; }
    .chev { background: none; border: none; cursor: pointer; color: var(--brand-muted); width: 22px; height: 22px; border-radius: 6px; padding: 0; }
    .chev:hover { background: rgba(19,133,182,0.12); }
    .chev-space { display: inline-block; width: 22px; }
    .inactive { opacity: 0.6; }
    .ext { color: var(--brand-muted); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9rem; }
    :host ::ng-deep .tag-sm .p-tag { font-size: 0.7rem; padding: 0.1rem 0.4rem; }
    @media (max-width: 900px) { .cat-grid { grid-template-columns: 130px 1fr; } .cat-grid .ext { display: none; } }

    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.45); z-index: 1000; backdrop-filter: blur(2px); }
    .ov-backdrop-top { z-index: 1002; }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(500px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28); padding: 1.6rem;
    }
    .ov-panel-sm { width: min(420px, calc(100vw - 2rem)); z-index: 1003; }
    .ov-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(19,133,182,0.1); }
    .ov-header strong { font-size: 1.2rem; color: var(--brand-ink); }
    .ov-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%; }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }

    .ficha-form { display: grid; gap: 1rem; }
    .ficha-form label > span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); display: block; margin-bottom: 0.25rem; }
    .ficha-form input:not([type=checkbox]), .ficha-form select {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25);
      border-radius: 10px; font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .ficha-form input:focus, .ficha-form select:focus { outline: none; border-color: var(--brand-blue, #1385B6); }
    .ficha-form select:disabled { opacity: 0.7; }
    .ficha-form .checkbox { display: flex; align-items: center; gap: 0.5rem; }
    .ficha-form .checkbox > span { margin: 0; }
    .note { margin: 0; background: rgba(19,133,182,0.08); border-radius: 10px; padding: 0.6rem 0.9rem; font-size: 0.85rem; color: var(--brand-ink-soft); }
    .req { color: var(--red-400, #f87171); }
    .ficha-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; }
    .confirm-text { margin: 0 0 1.2rem; color: var(--brand-ink); line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class FinanceChartEditorComponent implements OnChanges {
  private readonly api = inject(FinanceApiService);
  private readonly access = inject(FinanceAccessService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  @Input({ required: true }) buildingId!: string;
  @Input() canEdit = false;
  // La exportación necesita la configuración inicial completa.
  @Input() canExport = false;
  readonly today = new Date().toISOString().slice(0, 10).split('-').join('');
  @Output() changed = new EventEmitter<void>();

  readonly typeOrder = LEDGER_TYPE_ORDER;
  readonly expenseChoices = EXPENSE_CATEGORY_CHOICES;
  readonly incomeChoices = INCOME_CATEGORY_CHOICES;

  items: LedgerCategory[] = [];
  rows: TreeRow[] = [];
  collapsed = new Set<string>();
  search = '';
  onlyActive = false;
  loading = false;
  error = '';
  busyId = '';

  formVisible = false;
  editing: LedgerCategory | null = null;
  form = this.emptyForm();
  saving = false;
  deleteTarget: LedgerCategory | null = null;

  copyVisible = false;
  copySourceId = '';
  copying = false;
  copyResult: LedgerCategoryCopyResult | null = null;

  templateVisible = false;
  importVisible = false;
  planResult: LedgerPlanApplyResult | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['buildingId'] && this.buildingId) {
      this.load();
    }
  }

  typeLabel(type: LedgerCategoryType): string { return LEDGER_TYPE_LABELS[type] ?? type; }
  isMovementType(type: LedgerCategoryType): boolean { return MOVEMENT_TYPES.includes(type); }
  expenseLabel(c: BuildingExpenseCategory): string { return EXPENSE_CATEGORY_LABELS[c] ?? c; }
  incomeLabel(c: BuildingIncomeCategory): string { return INCOME_CATEGORY_LABELS[c] ?? c; }
  roleText(key: string): string { return roleLabel(key) || key; }
  trackRow(_: number, row: TreeRow): string { return row.item.id; }

  get activeCount(): number { return this.items.filter(i => i.isActive).length; }

  // Funciones de cobranza que ninguna cuenta del plan tiene asignadas.
  get missingCollection(): string[] {
    if (!this.items.length) return [];
    const taken = new Set(this.items.map(i => i.systemKey).filter((k): k is string => !!k));
    return LEDGER_ROLES.filter(r => r.collection && !taken.has(r.key)).map(r => r.label);
  }

  // Con qué categoría cuenta en la liquidación lo que se carga en la cuenta (vacío en grupos, de referencia y de cobranza).
  categoryText(item: LedgerCategory): string {
    if (item.expenseCategory) return this.expenseLabel(item.expenseCategory);
    if (item.incomeCategory) return this.incomeLabel(item.incomeCategory);
    return '';
  }

  deleteHint(item: LedgerCategory): string {
    if (item.isTemplate) return 'Las cuentas con función especial no se eliminan: desactivala (o pasá la función a otra cuenta)';
    if (item.hasChildren) return 'Tiene subcuentas';
    if (item.hasMovements) return 'Tiene gastos o ingresos cargados: desactivala';
    return 'Eliminar';
  }

  // ── Árbol ─────────────────────────────────────────────────────────────────

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getCategories(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        this.items = items;
        this.loading = false;
        this.rebuild();
      },
      error: err => {
        this.error = extractApiErrorMessage(err, 'No se pudo cargar el plan de cuentas.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Arma las filas visibles: el árbol ordenado por código, sin lo que cuelga de un grupo cerrado, filtrado por la búsqueda y por "solo activas".
  rebuild(): void {
    const byParent = new Map<string | null, LedgerCategory[]>();
    for (const item of this.items) {
      const key = item.parentId ?? null;
      const list = byParent.get(key) ?? [];
      list.push(item);
      byParent.set(key, list);
    }

    for (const list of byParent.values()) list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    const query = this.search.trim().toLowerCase();
    // Con búsqueda se muestran las coincidencias con todos sus grupos (y se ignora lo cerrado).
    let visible: Set<string> | null = null;
    if (query) {
      const byId = new Map(this.items.map(i => [i.id, i]));
      visible = new Set<string>();
      for (const item of this.items) {
        if (item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query)) {
          let cursor: LedgerCategory | undefined = item;
          while (cursor && !visible.has(cursor.id)) {
            visible.add(cursor.id);
            cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
          }
        }
      }
    }

    const rows: TreeRow[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const item of byParent.get(parent) ?? []) {
        if (visible && !visible.has(item.id)) continue;
        if (this.onlyActive && !item.isActive) continue;
        const expandable = (byParent.get(item.id)?.length ?? 0) > 0;
        const expanded = !!visible || !this.collapsed.has(item.id);
        rows.push({ item, depth, expandable, expanded });
        if (expandable && expanded) walk(item.id, depth + 1);
      }
    };

    walk(null, 0);
    this.rows = rows;
    this.cdr.markForCheck();
  }

  toggle(item: LedgerCategory): void {
    if (this.collapsed.has(item.id)) this.collapsed.delete(item.id); else this.collapsed.add(item.id);
    this.rebuild();
  }

  expandAll(): void { this.collapsed.clear(); this.rebuild(); }
  collapseAll(): void { this.collapsed = new Set(this.items.filter(i => i.hasChildren).map(i => i.id)); this.rebuild(); }

  // Tilde "Usar": activa o desactiva la cuenta (en un grupo, todo lo que contiene; al activar una cuenta se activan sus grupos).
  setActive(item: LedgerCategory, active: boolean): void {
    if (this.busyId) return;
    this.busyId = item.id;
    this.api.bulkActiveCategories(this.buildingId, [item.id], active).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.busyId = ''; this.load(); this.changed.emit(); },
      error: err => { this.busyId = ''; this.toastError(extractApiErrorMessage(err, 'No se pudo cambiar el estado de la cuenta.')); this.load(); }
    });
  }

  // ── Alta y edición ────────────────────────────────────────────────────────

  // Grupos posibles de la cuenta que se edita: todas las demás cuentas activas (o su padre actual) menos lo que cuelga de ella y las que
  // tienen función especial o movimientos sin ser grupos (no pueden pasar a ser grupo). El servidor valida el resto.
  get parentOptions(): { id: string; label: string }[] {
    const byParent = new Map<string, LedgerCategory[]>();
    for (const i of this.items) if (i.parentId) byParent.set(i.parentId, [...(byParent.get(i.parentId) ?? []), i]);
    const excluded = new Set<string>();
    if (this.editing) {
      const walk = (id: string) => { excluded.add(id); (byParent.get(id) ?? []).forEach(c => walk(c.id)); };
      walk(this.editing.id);
    }

    const byId = new Map(this.items.map(i => [i.id, i]));
    const depthOf = (i: LedgerCategory) => { let d = 0; let c: LedgerCategory | undefined = i; while (c?.parentId) { d++; c = byId.get(c.parentId); } return d; };

    return [...this.items]
      .filter(x => !excluded.has(x.id)
        && (x.isActive || x.id === this.editing?.parentId)
        && (x.hasChildren || (!x.isTemplate && !x.hasMovements)))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .map(x => ({ id: x.id, label: `${'  '.repeat(depthOf(x))}${x.code} · ${x.name} (${this.typeLabel(x.type)})` }));
  }

  // Una cuenta con función especial, o un grupo con subcuentas, no cambia de lugar ni de tipo.
  get lockedPlacement(): boolean {
    return !!this.editing && (this.editing.isTemplate || this.editing.hasChildren);
  }

  // Función especial: solo en cuentas finales (dentro de un grupo y sin subcuentas) de ingresos o egresos.
  get canHaveRole(): boolean {
    return !!this.form.parentId && !this.editing?.hasChildren && this.isMovementType(this.form.type);
  }

  get roleOptions(): LedgerRoleChoice[] {
    return LEDGER_ROLES.filter(r => r.type === this.form.type);
  }

  // Una cuenta de cobranza no se puede dejar sin esa función ni cambiarla por otra desde su propio editor.
  get roleLocked(): boolean {
    return !!this.editing?.systemKey?.startsWith('Collection.');
  }

  private get chosenRole(): LedgerRoleChoice | undefined {
    return LEDGER_ROLES.find(r => r.key === this.form.systemKey);
  }

  // La función de una categoría fija la categoría de la liquidación; las de cobranza no tienen.
  get roleFixesCategory(): boolean {
    return !!this.chosenRole && !this.chosenRole.collection;
  }

  // La categoría de la liquidación se define en las cuentas finales de gastos e ingresos que no son de cobranza.
  get showCategory(): boolean {
    return !!this.form.parentId && !this.editing?.hasChildren && this.isMovementType(this.form.type) && !this.chosenRole?.collection;
  }

  onRoleChange(): void {
    const role = this.chosenRole;
    if (role?.expenseCategory) this.form.expenseCategory = role.expenseCategory;
    if (role?.incomeCategory) this.form.incomeCategory = role.incomeCategory;
    this.cdr.markForCheck();
  }

  // Una cuenta hereda el tipo de su grupo; una función que no es del tipo elegido se descarta.
  onParentChange(): void {
    const parent = this.items.find(x => x.id === this.form.parentId);
    if (parent) this.form.type = parent.type;
    if (this.form.systemKey && !LEDGER_ROLES.some(r => r.key === this.form.systemKey && r.type === this.form.type)) this.form.systemKey = '';
  }

  // `parent` precargado = alta de una subcuenta dentro de ese grupo.
  openCreate(parent?: LedgerCategory): void {
    this.editing = null;
    this.form = { ...this.emptyForm(), parentId: parent?.id ?? null, type: parent?.type ?? 'Expense' };
    this.formVisible = true;
  }

  openEdit(item: LedgerCategory): void {
    this.editing = item;
    this.form = {
      parentId: item.parentId,
      type: item.type,
      code: item.code,
      name: item.name,
      externalCode: item.externalCode ?? '',
      isActive: item.isActive,
      systemKey: item.systemKey ?? '',
      expenseCategory: item.expenseCategory ?? ('Other' as BuildingExpenseCategory),
      incomeCategory: item.incomeCategory ?? ('Other' as BuildingIncomeCategory)
    };
    this.formVisible = true;
  }

  closeForm(): void {
    this.formVisible = false;
    this.editing = null;
  }

  save(): void {
    if (this.saving) return;
    const code = this.form.code.trim();
    const name = this.form.name.trim();
    if (!code) { this.toastError('El código es obligatorio.'); return; }
    if (!name) { this.toastError('El nombre es obligatorio.'); return; }

    const request = {
      buildingId: this.buildingId,
      parentId: this.form.parentId,
      code,
      name,
      type: this.form.type,
      externalCode: this.form.externalCode.trim() || null,
      isActive: this.form.isActive,
      // Solo las cuentas finales de gastos o ingresos definen su categoría de la liquidación.
      expenseCategory: this.showCategory && this.form.type === 'Expense' ? this.form.expenseCategory : null,
      incomeCategory: this.showCategory && this.form.type === 'Income' ? this.form.incomeCategory : null,
      // Sin dato (null) el servidor conserva la función; '' la quita.
      systemKey: this.canHaveRole ? this.form.systemKey : null
    };

    this.saving = true;
    const call = this.editing
      ? this.api.updateCategory(this.editing.id, request)
      : this.api.createCategory(request);

    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving = false;
        this.formVisible = false;
        this.editing = null;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Cuenta guardada.', life: 3500 });
        this.load();
        this.changed.emit();
      },
      error: err => {
        this.saving = false;
        this.toastError(extractApiErrorMessage(err, 'No se pudo guardar la cuenta.'));
      }
    });
  }

  // ── Plan genérico, importación y copia ────────────────────────────────────

  onPlanApplied(result: LedgerPlanApplyResult): void {
    this.templateVisible = false;
    this.importVisible = false;
    this.planResult = result;
    this.copyResult = null;
    this.collapsed.clear();
    this.load();
    this.changed.emit();
  }

  // Edificios con Finanzas habilitado de los que se puede copiar el plan (todos menos este).
  get sourceOptions() {
    return this.access.buildings().filter(b => b.buildingId !== this.buildingId);
  }

  openCopy(): void {
    this.copySourceId = '';
    this.copyVisible = true;
  }

  closeCopy(): void { if (!this.copying) this.copyVisible = false; }

  confirmCopy(): void {
    if (!this.copySourceId || this.copying) return;
    this.copying = true;
    this.api.copyCategories({ sourceBuildingId: this.copySourceId, targetBuildingId: this.buildingId })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => {
          this.copying = false;
          this.copyVisible = false;
          this.copyResult = result;
          this.planResult = null;
          this.load();
          this.changed.emit();
        },
        error: err => {
          this.copying = false;
          this.toastError(extractApiErrorMessage(err, 'No se pudo copiar el plan de cuentas.'));
        }
      });
  }

  askDelete(item: LedgerCategory): void { this.deleteTarget = item; }
  cancelDelete(): void { if (!this.saving) this.deleteTarget = null; }

  confirmDelete(): void {
    const target = this.deleteTarget;
    if (!target || this.saving) return;
    this.saving = true;
    this.api.deleteCategory(target.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving = false;
        this.deleteTarget = null;
        this.load();
        this.changed.emit();
      },
      error: err => {
        this.saving = false;
        this.deleteTarget = null;
        this.toastError(extractApiErrorMessage(err, 'No se pudo eliminar la cuenta.'));
      }
    });
  }

  private toastError(detail: string): void {
    this.msg.add({ severity: 'error', summary: 'Error', detail, life: 6000 });
    this.cdr.markForCheck();
  }

  private emptyForm() {
    return {
      parentId: null as string | null,
      type: 'Expense' as LedgerCategoryType,
      code: '',
      name: '',
      externalCode: '',
      isActive: true,
      systemKey: '',
      expenseCategory: 'Other' as BuildingExpenseCategory,
      incomeCategory: 'Other' as BuildingIncomeCategory
    };
  }
}
