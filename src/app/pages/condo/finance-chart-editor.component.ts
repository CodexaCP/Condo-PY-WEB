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
import { BuildingExpenseCategory, BuildingIncomeCategory, LedgerCategory, LedgerCategoryCopyResult, LedgerCategoryType } from '../../api/models';
import { EXPENSE_CATEGORY_CHOICES, EXPENSE_CATEGORY_LABELS, INCOME_CATEGORY_CHOICES, INCOME_CATEGORY_LABELS } from './finance-format';

const TYPE_LABELS: Record<LedgerCategoryType, string> = {
  Fund: 'Fondos',
  Income: 'Ingresos',
  Expense: 'Gastos'
};

// El orden en que se muestran las secciones del plan de cuentas.
const TYPE_ORDER: LedgerCategoryType[] = ['Fund', 'Income', 'Expense'];

interface ChartSection {
  type: LedgerCategoryType;
  label: string;
  groups: { group: LedgerCategory; children: LedgerCategory[] }[];
}

// Plan de cuentas del edificio: dos niveles (rubro y subrubro) con códigos editables, que nace de la plantilla estándar.
// Los rubros de la plantilla se pueden renombrar, recodificar y desactivar, pero no mover ni eliminar. Los gastos e ingresos
// eligen uno de estos subrubros al cargarse; en los rubros propios se define con qué categoría cuentan en la liquidación.
// Un rubro con gastos o ingresos cargados solo se desactiva. Se puede copiar el plan de otro edificio.
@Component({
  standalone: true,
  selector: 'app-finance-chart-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Message, Tag],
  template: `
    <div class="intro">
      <p>
        Los rubros ordenan los ingresos y gastos del edificio: al cargar un gasto o un ingreso se elige uno de los subrubros activos. El <strong>código</strong> es editable y sirve para exportar los datos al contador;
        el <strong>código del contador</strong> es opcional y permite mapear cada rubro a su plan de cuentas.
        Desactivá los rubros que el edificio no usa y agregá los propios que necesite.
      </p>
      <div class="intro-actions" *ngIf="canEdit">
        <p-button type="button" label="Copiar de otro edificio" icon="pi pi-copy" severity="secondary" [outlined]="true" (onClick)="openCopy()"></p-button>
        <p-button type="button" label="Nuevo rubro" icon="pi pi-plus" (onClick)="openCreate()"></p-button>
      </div>
    </div>

    <p-message *ngIf="copyResult as r" severity="success" styleClass="copy-result">
      <div>
        <strong>Plan copiado:</strong> {{ r.created }} rubros creados, {{ r.updated }} actualizados<span *ngIf="r.skipped">, {{ r.skipped }} sin copiar</span>.
        <ul *ngIf="r.messages.length"><li *ngFor="let m of r.messages">{{ m }}</li></ul>
      </div>
    </p-message>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading">Cargando plan de cuentas...</p>
    <p class="app-state" *ngIf="!loading && !error && !items.length">El plan de cuentas está vacío.</p>

    <section class="chart-section" *ngFor="let section of sections">
      <h3>{{ section.label }}</h3>
      <div class="app-list">
        <ng-container *ngFor="let entry of section.groups">
          <div class="app-row cat-grid group-row" [class.inactive]="!entry.group.isActive">
            <code>{{ entry.group.code }}</code>
            <strong>{{ entry.group.name }}</strong>
            <span class="ext">{{ entry.group.externalCode || '—' }}</span>
            <p-tag [value]="entry.group.isActive ? 'Activo' : 'Inactivo'" [severity]="entry.group.isActive ? 'success' : 'secondary'"></p-tag>
            <div class="app-actions" *ngIf="canEdit">
              <p-button type="button" icon="pi pi-plus" severity="secondary" [rounded]="true" [text]="true" (onClick)="openCreate(entry.group)" aria-label="Agregar subrubro" title="Agregar subrubro"></p-button>
              <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="openEdit(entry.group)" aria-label="Editar"></p-button>
              <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" (onClick)="askDelete(entry.group)"
                        [disabled]="entry.group.isTemplate || entry.group.hasChildren" aria-label="Eliminar"
                        [title]="entry.group.isTemplate ? 'Los rubros de la plantilla no se eliminan: desactivalos' : (entry.group.hasChildren ? 'Tiene subrubros' : 'Eliminar')"></p-button>
            </div>
            <span *ngIf="!canEdit"></span>
          </div>
          <div class="app-row cat-grid child-row" *ngFor="let child of entry.children" [class.inactive]="!child.isActive">
            <code>{{ child.code }}</code>
            <span class="child-name">
              <span class="child-text">
                {{ child.name }}
                <small class="liq" *ngIf="categoryText(child) as liq">En la liquidación: {{ liq }}</small>
              </span>
              <p-tag *ngIf="child.isTemplate" value="Plantilla" severity="info" styleClass="tag-sm"></p-tag>
              <p-tag *ngIf="child.hasMovements" value="Con movimientos" severity="secondary" styleClass="tag-sm"></p-tag>
            </span>
            <span class="ext">{{ child.externalCode || '—' }}</span>
            <p-tag [value]="child.isActive ? 'Activo' : 'Inactivo'" [severity]="child.isActive ? 'success' : 'secondary'"></p-tag>
            <div class="app-actions" *ngIf="canEdit">
              <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="openEdit(child)" aria-label="Editar"></p-button>
              <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" (onClick)="askDelete(child)"
                        [disabled]="child.isTemplate || child.hasMovements" aria-label="Eliminar"
                        [title]="child.isTemplate ? 'Los rubros de la plantilla no se eliminan: desactivalos' : (child.hasMovements ? 'Tiene gastos o ingresos cargados: desactivalo' : 'Eliminar')"></p-button>
            </div>
            <span *ngIf="!canEdit"></span>
          </div>
        </ng-container>
      </div>
    </section>

    <div class="ov-backdrop" *ngIf="formVisible" (click)="closeForm()"></div>
    <div class="ov-panel" *ngIf="formVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ editing ? 'Editar rubro' : 'Nuevo rubro' }}</strong>
        <button class="ov-close" type="button" (click)="closeForm()">✕</button>
      </div>
      <form class="ficha-form" (ngSubmit)="save()">
        <p class="note" *ngIf="editing?.isTemplate">
          Rubro de la plantilla: se puede renombrar, recodificar y desactivar, pero no mover ni cambiar de tipo.
        </p>
        <label>
          <span>Rubro padre</span>
          <select [(ngModel)]="form.parentId" name="parentId" [disabled]="lockedPlacement" (ngModelChange)="onParentChange()">
            <option [ngValue]="null">— Ninguno: es un rubro principal —</option>
            <option *ngFor="let g of parentOptions" [ngValue]="g.id">{{ g.code }} · {{ g.name }} ({{ typeLabel(g.type) }})</option>
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select [(ngModel)]="form.type" name="type" [disabled]="lockedPlacement || !!form.parentId">
            <option *ngFor="let t of typeOrder" [value]="t">{{ typeLabel(t) }}</option>
          </select>
        </label>
        <p class="note" *ngIf="editing?.hasMovements">
          Este rubro ya tiene gastos o ingresos cargados: no se puede eliminar ni cambiar de tipo o de categoría. Si ya no se usa, desactivalo.
        </p>
        <label *ngIf="showCategory">
          <span>En la liquidación cuenta como</span>
          <select *ngIf="form.type === 'Expense'" [(ngModel)]="form.expenseCategory" name="expenseCategory" [disabled]="!!editing?.hasMovements">
            <option *ngFor="let c of expenseChoices" [value]="c">{{ expenseLabel(c) }}</option>
          </select>
          <select *ngIf="form.type === 'Income'" [(ngModel)]="form.incomeCategory" name="incomeCategory" [disabled]="!!editing?.hasMovements">
            <option *ngFor="let c of incomeChoices" [value]="c">{{ incomeLabel(c) }}</option>
          </select>
          <small class="hint">Los gastos o ingresos que se carguen en este rubro se agrupan en la liquidación con esta categoría.</small>
        </label>
        <p class="note" *ngIf="editing?.isTemplate && categoryText(editing!) as liq">En la liquidación este rubro cuenta como «{{ liq }}».</p>
        <label>
          <span>Código <span class="req">*</span></span>
          <input [(ngModel)]="form.code" name="code" required maxlength="30" placeholder="Ej.: 5.3.06" />
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
          <span>Rubro activo</span>
        </label>
        <div class="ficha-footer">
          <p-button type="button" label="Cancelar" severity="secondary" [outlined]="true" (onClick)="closeForm()"></p-button>
          <p-button type="submit" [loading]="saving" [label]="editing ? 'Guardar cambios' : 'Crear rubro'"></p-button>
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
        Se copian los nombres, códigos del contador y rubros activos de otro edificio, y se crean sus rubros propios. No se borra nada de este
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

    <div class="ov-backdrop ov-backdrop-top" *ngIf="deleteTarget" (click)="cancelDelete()"></div>
    <div class="ov-panel ov-panel-sm" *ngIf="deleteTarget" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Eliminar rubro</strong>
        <button class="ov-close" type="button" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">¿Eliminar el rubro <strong>{{ deleteTarget.code }} · {{ deleteTarget.name }}</strong>?</p>
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
    .child-text { display: grid; gap: 0.1rem; }
    .liq, .hint { color: var(--brand-muted); font-size: 0.78rem; }
    .hint { display: block; margin-top: 0.3rem; }
    .copy-field { display: block; }
    .copy-field > span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); display: block; margin-bottom: 0.25rem; }
    .copy-field select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px; font: inherit; }
    :host ::ng-deep .copy-result ul { margin: 0.4rem 0 0; padding-left: 1.1rem; }
    .chart-section { margin-top: 1.25rem; }
    .chart-section h3 { margin: 0 0 0.6rem; font-size: 1.05rem; color: var(--brand-ink); }
    .app-list { gap: 0.4rem; }
    .cat-grid { grid-template-columns: 90px 3fr 1.2fr 0.9fr 1.3fr; padding: 0.6rem 1rem; }
    .group-row { background: var(--brand-gradient-soft); }
    .child-row .child-name { padding-left: 1.2rem; display: inline-flex; align-items: center; gap: 0.5rem; }
    .inactive { opacity: 0.6; }
    .ext { color: var(--brand-muted); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9rem; }
    :host ::ng-deep .tag-sm .p-tag { font-size: 0.7rem; padding: 0.1rem 0.4rem; }
    @media (max-width: 900px) { .cat-grid { grid-template-columns: 70px 1fr; } .cat-grid .ext { display: none; } }

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
  @Output() changed = new EventEmitter<void>();

  readonly typeOrder = TYPE_ORDER;
  readonly expenseChoices = EXPENSE_CATEGORY_CHOICES;
  readonly incomeChoices = INCOME_CATEGORY_CHOICES;

  items: LedgerCategory[] = [];
  sections: ChartSection[] = [];
  loading = false;
  error = '';

  formVisible = false;
  editing: LedgerCategory | null = null;
  form = this.emptyForm();
  saving = false;
  deleteTarget: LedgerCategory | null = null;

  copyVisible = false;
  copySourceId = '';
  copying = false;
  copyResult: LedgerCategoryCopyResult | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['buildingId'] && this.buildingId) {
      this.load();
    }
  }

  typeLabel(type: LedgerCategoryType): string { return TYPE_LABELS[type] ?? type; }

  // Los rubros principales activos (más el padre actual del rubro que se edita, aunque esté inactivo).
  get parentOptions(): LedgerCategory[] {
    return this.items.filter(x => !x.parentId && x.id !== this.editing?.id && (x.isActive || x.id === this.editing?.parentId));
  }

  expenseLabel(c: BuildingExpenseCategory): string { return EXPENSE_CATEGORY_LABELS[c] ?? c; }
  incomeLabel(c: BuildingIncomeCategory): string { return INCOME_CATEGORY_LABELS[c] ?? c; }

  // Con qué categoría cuenta en la liquidación lo que se carga en el subrubro (vacío en los rubros principales, de fondo y de cobranza).
  categoryText(item: LedgerCategory): string {
    if (item.expenseCategory) return this.expenseLabel(item.expenseCategory);
    if (item.incomeCategory) return this.incomeLabel(item.incomeCategory);
    return '';
  }

  // La categoría de la liquidación se define en los subrubros propios de gastos e ingresos (los de la plantilla ya la traen).
  get showCategory(): boolean {
    return !!this.form.parentId && (this.form.type === 'Expense' || this.form.type === 'Income') && !this.editing?.isTemplate;
  }

  // Un rubro de la plantilla, o uno con subrubros, no cambia de lugar ni de tipo. Con movimientos tampoco cambia de tipo.
  get lockedPlacement(): boolean {
    return !!this.editing && (this.editing.isTemplate || this.editing.hasChildren);
  }

  // Edificios con Finanzas habilitado de los que se puede copiar el plan (todos menos este).
  get sourceOptions() {
    return this.access.buildings().filter(b => b.buildingId !== this.buildingId);
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getCategories(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        this.items = items;
        this.sections = this.buildSections(items);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = extractApiErrorMessage(err, 'No se pudo cargar el plan de cuentas.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // `parent` precargado = alta de un subrubro dentro de ese rubro.
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
      expenseCategory: item.expenseCategory ?? ('Other' as BuildingExpenseCategory),
      incomeCategory: item.incomeCategory ?? ('Other' as BuildingIncomeCategory)
    };
    this.formVisible = true;
  }

  closeForm(): void {
    this.formVisible = false;
    this.editing = null;
  }

  // Un subrubro hereda el tipo de su rubro padre.
  onParentChange(): void {
    const parent = this.items.find(x => x.id === this.form.parentId);
    if (parent) this.form.type = parent.type;
  }

  save(): void {
    if (this.saving) return;
    const code = this.form.code.trim();
    const name = this.form.name.trim();
    if (!code) { this.toastError('El código del rubro es obligatorio.'); return; }
    if (!name) { this.toastError('El nombre del rubro es obligatorio.'); return; }

    const request = {
      buildingId: this.buildingId,
      parentId: this.form.parentId,
      code,
      name,
      type: this.form.type,
      externalCode: this.form.externalCode.trim() || null,
      isActive: this.form.isActive,
      // Solo los subrubros propios de gastos o ingresos definen su categoría de la liquidación.
      expenseCategory: this.showCategory && this.form.type === 'Expense' ? this.form.expenseCategory : null,
      incomeCategory: this.showCategory && this.form.type === 'Income' ? this.form.incomeCategory : null
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
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Rubro guardado.', life: 3500 });
        this.load();
        this.changed.emit();
      },
      error: err => {
        this.saving = false;
        this.toastError(extractApiErrorMessage(err, 'No se pudo guardar el rubro.'));
      }
    });
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
        this.toastError(extractApiErrorMessage(err, 'No se pudo eliminar el rubro.'));
      }
    });
  }

  private buildSections(items: LedgerCategory[]): ChartSection[] {
    return TYPE_ORDER
      .map(type => ({
        type,
        label: TYPE_LABELS[type],
        groups: items
          .filter(x => x.type === type && !x.parentId)
          .map(group => ({ group, children: items.filter(c => c.parentId === group.id) }))
      }))
      .filter(section => section.groups.length > 0);
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
      expenseCategory: 'Other' as BuildingExpenseCategory,
      incomeCategory: 'Other' as BuildingIncomeCategory
    };
  }
}
