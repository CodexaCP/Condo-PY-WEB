import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinancialAccount, FinancialAccountType } from '../../api/models';

const TYPE_LABELS: Record<FinancialAccountType, string> = {
  Cash: 'Caja',
  Bank: 'Banco',
  ReserveFund: 'Fondo de reserva'
};

// Cuentas financieras del edificio (caja, bancos y fondo de reserva) con su saldo inicial a la fecha de arranque.
// Como máximo una caja y un fondo de reserva por edificio; los bancos pueden ser varios.
@Component({
  standalone: true,
  selector: 'app-finance-accounts-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, InputNumber, Message, Tag],
  template: `
    <div class="intro">
      <p>
        Cargá las cuentas donde el edificio tiene su dinero y el <strong>saldo inicial</strong> de cada una
        <ng-container *ngIf="startDate"> al <strong>{{ startDate | date: 'dd/MM/yyyy' }}</strong> (fecha de arranque)</ng-container>.
        Desde esa fecha el módulo suma los cobros y resta los pagos.
      </p>
      <p-button *ngIf="canEdit" type="button" label="Nueva cuenta" icon="pi pi-plus" (onClick)="openCreate()"></p-button>
    </div>

    <div class="suggestions" *ngIf="canEdit && suggestions.length">
      <span>Sugeridas:</span>
      <p-button *ngFor="let s of suggestions" type="button" [label]="s.label" icon="pi pi-plus" size="small" severity="secondary" [outlined]="true" (onClick)="openCreate(s.type, s.name)"></p-button>
    </div>

    <div class="default-account" *ngIf="operatingAccounts.length > 0">
      <label>
        <span>Cuenta por defecto</span>
        <select [ngModel]="defaultAccountId" (ngModelChange)="changeDefault($event)" [disabled]="!canEdit || savingDefault">
          <option [ngValue]="null">Automática (el único banco activo)</option>
          <option *ngFor="let a of operatingAccounts" [ngValue]="a.id">{{ a.name }}</option>
        </select>
      </label>
      <p>
        Es donde el sistema asienta los cobros que no son en efectivo, los ingresos y los gastos del edificio, ya que no indican de qué cuenta salen.
        Los cobros en efectivo entran a la caja y todo lo del fondo de reserva, a la cuenta del fondo.
      </p>
    </div>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading">Cargando cuentas...</p>
    <p class="app-state" *ngIf="!loading && !error && !items.length">Todavía no hay cuentas cargadas.</p>

    <div class="app-list" *ngIf="items.length">
      <div class="app-row header acc-grid">
        <span>Cuenta</span>
        <span>Tipo</span>
        <span class="num">Saldo inicial</span>
        <span>Estado</span>
        <span></span>
      </div>
      <div class="app-row acc-grid" *ngFor="let item of items">
        <strong>{{ item.name }}</strong>
        <span>{{ typeLabel(item.type) }}</span>
        <span class="num">{{ formatCurrency(item.openingBalance) }}</span>
        <p-tag [value]="item.isActive ? 'Activa' : 'Inactiva'" [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        <div class="app-actions" *ngIf="canEdit">
          <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="openEdit(item)" aria-label="Editar"></p-button>
          <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" (onClick)="askDelete(item)" aria-label="Eliminar"></p-button>
        </div>
        <span *ngIf="!canEdit"></span>
      </div>
      <div class="app-row acc-grid total">
        <strong>Total de saldos iniciales</strong>
        <span></span>
        <span class="num"><strong>{{ formatCurrency(totalOpening) }}</strong></span>
        <span></span>
        <span></span>
      </div>
    </div>

    <div class="ov-backdrop" *ngIf="formVisible" (click)="closeForm()"></div>
    <div class="ov-panel" *ngIf="formVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ editing ? 'Editar cuenta' : 'Nueva cuenta' }}</strong>
        <button class="ov-close" type="button" (click)="closeForm()">✕</button>
      </div>
      <form class="ficha-form" (ngSubmit)="save()">
        <label>
          <span>Nombre <span class="req">*</span></span>
          <input [(ngModel)]="form.name" name="name" required maxlength="200" placeholder="Ej.: Caja, Banco Itaú cta. cte." />
        </label>
        <label>
          <span>Tipo</span>
          <select [(ngModel)]="form.type" name="type">
            <option *ngFor="let t of typeOptions" [value]="t" [disabled]="typeTaken(t)">
              {{ typeLabel(t) }}{{ typeTaken(t) ? ' (ya existe)' : '' }}
            </option>
          </select>
        </label>
        <label>
          <span>Saldo inicial (₲)</span>
          <p-inputnumber [(ngModel)]="form.openingBalance" name="openingBalance" [useGrouping]="true" prefix="₲ " [min]="0" [minFractionDigits]="0" [maxFractionDigits]="0" styleClass="w-full"></p-inputnumber>
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

    <div class="ov-backdrop ov-backdrop-top" *ngIf="deleteTarget" (click)="cancelDelete()"></div>
    <div class="ov-panel ov-panel-sm" *ngIf="deleteTarget" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Eliminar cuenta</strong>
        <button class="ov-close" type="button" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">¿Eliminar la cuenta <strong>{{ deleteTarget.name }}</strong>? Todavía no tiene movimientos, así que se puede dar de baja.</p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar" severity="danger" [loading]="saving" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .intro { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .intro p { margin: 0; max-width: 62ch; color: var(--brand-ink-soft); line-height: 1.5; }
    .default-account { margin-bottom: 1rem; padding: 0.8rem 1rem; border-radius: 12px; background: var(--brand-gradient-soft); }
    .default-account label span { display: block; margin-bottom: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .default-account select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px; min-width: 260px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: #fff;
    }
    .default-account p { margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--brand-ink-soft); line-height: 1.45; max-width: 70ch; }
    .suggestions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; color: var(--brand-muted); font-size: 0.9rem; }
    .acc-grid { grid-template-columns: 2fr 1.2fr 1.4fr 1fr 1fr; }
    .num { text-align: right; }
    .app-row.total { background: transparent; border-style: dashed; }
    @media (max-width: 900px) { .acc-grid { grid-template-columns: 1fr 1fr; } .app-row.header { display: none; } .num { text-align: left; } }

    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.45); z-index: 1000; backdrop-filter: blur(2px); }
    .ov-backdrop-top { z-index: 1002; }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(480px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
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
    .ficha-form .checkbox { display: flex; align-items: center; gap: 0.5rem; }
    .ficha-form .checkbox > span { margin: 0; }
    .req { color: var(--red-400, #f87171); }
    .ficha-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; }
    .confirm-text { margin: 0 0 1.2rem; color: var(--brand-ink); line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class FinanceAccountsEditorComponent implements OnChanges {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  @Input({ required: true }) buildingId!: string;
  @Input() canEdit = false;
  @Input() startDate: string | null = null;
  @Input() defaultAccountId: string | null = null;
  // Avisa a la pantalla que cambió algo (cantidad de cuentas, qué falta para completar la configuración).
  @Output() changed = new EventEmitter<void>();

  readonly typeOptions: FinancialAccountType[] = ['Cash', 'Bank', 'ReserveFund'];

  items: FinancialAccount[] = [];
  loading = false;
  error = '';

  formVisible = false;
  editing: FinancialAccount | null = null;
  form = this.emptyForm();
  saving = false;
  deleteTarget: FinancialAccount | null = null;
  savingDefault = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['buildingId'] && this.buildingId) {
      this.load();
    }
  }

  // Cajas y bancos activos: pueden ser la cuenta por defecto (el fondo de reserva tiene su propia cuenta).
  get operatingAccounts(): FinancialAccount[] {
    return this.items.filter(x => x.isActive && x.type !== 'ReserveFund');
  }

  changeDefault(accountId: string | null): void {
    if (this.savingDefault || accountId === this.defaultAccountId) return;
    this.savingDefault = true;
    this.api.setDefaultAccount(this.buildingId, accountId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.savingDefault = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Cuenta por defecto guardada.', life: 3500 });
        this.changed.emit();
        this.cdr.markForCheck();
      },
      error: err => {
        this.savingDefault = false;
        this.toastError(extractApiErrorMessage(err, 'No se pudo guardar la cuenta por defecto.'));
      }
    });
  }

  get totalOpening(): number {
    return this.items.filter(x => x.isActive).reduce((sum, x) => sum + x.openingBalance, 0);
  }

  // Caja y fondo de reserva faltantes, y siempre la opción de sumar un banco.
  get suggestions(): { label: string; type: FinancialAccountType; name: string }[] {
    const result: { label: string; type: FinancialAccountType; name: string }[] = [];
    if (!this.items.some(x => x.type === 'Cash')) result.push({ label: 'Caja', type: 'Cash', name: 'Caja' });
    if (!this.items.some(x => x.type === 'Bank')) result.push({ label: 'Banco', type: 'Bank', name: '' });
    if (!this.items.some(x => x.type === 'ReserveFund')) result.push({ label: 'Fondo de reserva', type: 'ReserveFund', name: 'Fondo de reserva' });
    return result;
  }

  typeLabel(type: FinancialAccountType): string { return TYPE_LABELS[type] ?? type; }

  // Una sola caja y un solo fondo de reserva por edificio (sin contar la cuenta que se está editando).
  typeTaken(type: FinancialAccountType): boolean {
    return type !== 'Bank' && this.items.some(x => x.type === type && x.id !== this.editing?.id);
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0 }).format(v);
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.getAccounts(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        this.items = items;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = extractApiErrorMessage(err, 'No se pudieron cargar las cuentas.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openCreate(type?: FinancialAccountType, name = ''): void {
    this.editing = null;
    const firstFree = this.typeOptions.find(t => !this.typeTaken(t)) ?? 'Bank';
    this.form = { ...this.emptyForm(), type: type ?? firstFree, name };
    this.formVisible = true;
  }

  openEdit(item: FinancialAccount): void {
    this.editing = item;
    this.form = { name: item.name, type: item.type, openingBalance: item.openingBalance, isActive: item.isActive };
    this.formVisible = true;
  }

  closeForm(): void {
    this.formVisible = false;
    this.editing = null;
  }

  save(): void {
    if (this.saving) return;
    const name = this.form.name.trim();
    if (!name) { this.toastError('El nombre de la cuenta es obligatorio.'); return; }

    const request = {
      buildingId: this.buildingId,
      name,
      type: this.form.type,
      openingBalance: this.form.openingBalance ?? 0,
      isActive: this.form.isActive
    };

    this.saving = true;
    const call = this.editing
      ? this.api.updateAccount(this.editing.id, request)
      : this.api.createAccount(request);

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

  askDelete(item: FinancialAccount): void { this.deleteTarget = item; }
  cancelDelete(): void { if (!this.saving) this.deleteTarget = null; }

  confirmDelete(): void {
    const target = this.deleteTarget;
    if (!target || this.saving) return;
    this.saving = true;
    this.api.deleteAccount(target.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    return { name: '', type: 'Cash' as FinancialAccountType, openingBalance: 0 as number | null, isActive: true };
  }
}
