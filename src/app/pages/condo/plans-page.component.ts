import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { PlansApiService } from '../../api/plans-api.service';
import { BillingCycle, Plan, PlanCreateRequest, PlanUpdateRequest } from '../../api/models';

const BILLING_LABELS: Record<BillingCycle, string> = {
  Monthly: 'Mensual',
  Quarterly: 'Trimestral',
  SemiAnnual: 'Semestral',
  Annual: 'Anual',
};

@Component({
  standalone: true,
  selector: 'app-plans-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Planes de suscripción</h1>
            <p>Gestión de planes disponibles para asignar a edificios, condominios o empresas.</p>
          </div>
        </div>
        <p-button label="Nuevo plan" icon="pi pi-plus" (onClick)="openCreate()"></p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando planes...</p>
      <p class="app-state" *ngIf="!loading && !items.length && !pageError">No hay planes registrados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header plans-grid">
          <span>Nombre</span>
          <span>Precio</span>
          <span>Ciclo</span>
          <span>Gracia</span>
          <span>Edificios</span>
          <span>Estado</span>
        </div>
        <div class="app-row plans-grid" *ngFor="let item of items">
          <div class="name-cell">
            <button class="row-link" (click)="openEdit(item)">{{ item.name }}</button>
            <p-tag *ngIf="item.isDefault" value="Por defecto" severity="info" styleClass="tag-sm"></p-tag>
          </div>
          <span>{{ item.price === 0 ? 'Gratis' : formatCurrency(item.price) }}</span>
          <span>{{ billingLabel(item.billingCycle) }}</span>
          <span>{{ item.gracePeriodDays }} días</span>
          <span>{{ item.assignedBuildingsCount }}</span>
          <p-tag [value]="item.isActive ? 'Activo' : 'Inactivo'"
                 [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        </div>
      </div>
    </p-card>

    <!-- BACKDROP -->
    <div class="ov-backdrop" *ngIf="dialogVisible" (click)="closeDialog()"></div>

    <!-- FICHA -->
    <div class="ov-panel" *ngIf="dialogVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ selected ? selected.name : 'Nuevo plan' }}</strong>
        <button class="ov-close" (click)="closeDialog()">✕</button>
      </div>

      <form class="ficha-form" (ngSubmit)="save()">
        <label>
          <span>Nombre <span class="req">*</span></span>
          <input [(ngModel)]="form.name" name="name" required maxlength="120" />
        </label>
        <label>
          <span>Descripción <span class="req">*</span></span>
          <textarea [(ngModel)]="form.description" name="description" rows="3" maxlength="500"></textarea>
        </label>
        <label>
          <span>Precio (₲)</span>
          <input [(ngModel)]="form.price" name="price" type="number" min="0" step="1000" />
        </label>
        <label>
          <span>Ciclo de facturación</span>
          <select [(ngModel)]="form.billingCycle" name="billingCycle">
            <option value="Monthly">Mensual</option>
            <option value="Quarterly">Trimestral</option>
            <option value="SemiAnnual">Semestral</option>
            <option value="Annual">Anual</option>
          </select>
        </label>
        <label>
          <span>Días de gracia</span>
          <input [(ngModel)]="form.gracePeriodDays" name="gracePeriodDays" type="number" min="0" max="365" />
        </label>
        <label *ngIf="selected" class="checkbox">
          <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" />
          <span>Plan activo</span>
        </label>

        <p class="warn-assigned" *ngIf="selected?.isAssigned && !selected?.isDefault">
          Este plan tiene edificios asignados. Solo se pueden editar nombre, descripción y estado activo.
          No se puede eliminar.
        </p>

        <div class="ficha-footer">
          <div class="footer-left">
            <p-button *ngIf="selected && !selected.isAssigned" type="button" label="Eliminar"
                      severity="danger" [outlined]="true" (onClick)="askDelete()"></p-button>
            <p-button *ngIf="selected" type="button" label="Clonar" icon="pi pi-copy"
                      severity="secondary" [outlined]="true" [loading]="isCloning" (onClick)="clone()"></p-button>
          </div>
          <p-button type="submit" [loading]="isSaving"
                    [label]="selected ? 'Guardar cambios' : 'Crear plan'"></p-button>
        </div>
      </form>
    </div>

    <!-- BACKDROP CONFIRM -->
    <div class="ov-backdrop ov-backdrop-top" *ngIf="confirmVisible" (click)="cancelDelete()"></div>

    <!-- CONFIRM ELIMINAR -->
    <div class="ov-panel ov-panel-sm" *ngIf="confirmVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Confirmar eliminación</strong>
        <button class="ov-close" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">
        ¿Eliminar el plan <strong>{{ selected?.name }}</strong> de forma permanente?
        Esta acción no se puede deshacer.
      </p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar definitivamente" severity="danger" [loading]="isDeleting" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .plans-grid { grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr; }
    .name-cell { display: flex; align-items: center; gap: 0.5rem; }
    .row-link {
      background: none; border: none; padding: 0; font: inherit; font-weight: 700;
      color: var(--brand-blue); cursor: pointer; text-align: left; text-decoration: underline dotted;
    }
    .row-link:hover { color: var(--brand-ink); }
    :host ::ng-deep .tag-sm .p-tag { font-size: 0.7rem; padding: 0.1rem 0.4rem; }

    /* OVERLAY */
    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(15,35,50,0.45);
      z-index: 1000; backdrop-filter: blur(2px); animation: fadeIn 0.15s ease;
    }
    .ov-backdrop-top { z-index: 1002; }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(540px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28);
      padding: 1.6rem; animation: slideUp 0.2s cubic-bezier(.4,0,.2,1);
    }
    .ov-panel-sm { width: min(420px, calc(100vw - 2rem)); z-index: 1003; }
    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
                         to   { opacity: 1; transform: translate(-50%, -50%); } }
    .ov-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.2rem; padding-bottom: 1rem;
      border-bottom: 1px solid rgba(19,133,182,0.1);
    }
    .ov-header strong { font-size: 1.2rem; color: var(--brand-ink); }
    .ov-close {
      background: none; border: none; cursor: pointer; font-size: 1.1rem;
      color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center; transition: background 0.15s;
    }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }

    .ficha-form { display: grid; gap: 1rem; }
    .ficha-form label > span { font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); display: block; margin-bottom: 0.25rem; }
    .ficha-form input, .ficha-form select, .ficha-form textarea {
      width: 100%; padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25);
      border-radius: 10px; font: inherit; font-size: 0.95rem; color: var(--brand-ink);
      background: var(--surface-ground, #f8fafc); transition: border-color 0.15s;
    }
    .ficha-form input:focus, .ficha-form select:focus, .ficha-form textarea:focus {
      outline: none; border-color: var(--brand-blue);
    }
    .ficha-form textarea { resize: vertical; }
    .ficha-form .checkbox { display: flex; align-items: center; gap: 0.5rem; }
    .ficha-form .checkbox > span { margin: 0; }
    .ficha-form .checkbox input { width: auto; }
    .req { color: var(--red-400); }

    .warn-assigned {
      background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.35);
      border-radius: 10px; padding: 0.6rem 0.9rem; font-size: 0.85rem; color: #713f12;
    }

    .ficha-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.5rem; }
    .footer-left { display: flex; gap: 0.5rem; }
    .confirm-text { margin: 0 0 1.2rem; color: var(--brand-ink); line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class PlansPageComponent implements OnInit {
  private readonly api = inject(PlansApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  items: Plan[] = [];
  loading = true;
  pageError = '';

  dialogVisible = false;
  confirmVisible = false;
  selected: Plan | null = null;
  form = this.emptyForm();
  isSaving = false;
  isDeleting = false;
  isCloning = false;

  ngOnInit(): void {
    this.api.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        this.items = this.sort(items);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.pageError = 'No se pudieron cargar los planes.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openCreate(): void {
    this.selected = null;
    this.form = this.emptyForm();
    this.dialogVisible = true;
  }

  openEdit(item: Plan): void {
    this.selected = item;
    this.form = {
      name: item.name,
      description: item.description,
      price: item.price,
      billingCycle: item.billingCycle,
      gracePeriodDays: item.gracePeriodDays,
      isActive: item.isActive,
    };
    this.dialogVisible = true;
  }

  closeDialog(): void {
    this.dialogVisible = false;
    this.confirmVisible = false;
    this.selected = null;
  }

  save(): void {
    if (this.isSaving) return;
    const name = this.form.name.trim();
    const description = this.form.description.trim();
    if (!name) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre es obligatorio.', life: 5000 }); return; }
    if (!description) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'La descripción es obligatoria.', life: 5000 }); return; }

    this.isSaving = true;
    if (this.selected) {
      const req: PlanUpdateRequest = { name, description, price: this.form.price, billingCycle: this.form.billingCycle, gracePeriodDays: this.form.gracePeriodDays, isActive: this.form.isActive };
      this.api.update(this.selected.id, req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: item => {
          this.items = this.sort(this.items.map(x => x.id === item.id ? item : x));
          this.selected = item;
          this.isSaving = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Plan actualizado.', life: 4000 });
          this.cdr.markForCheck();
        },
        error: err => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar.'), life: 5000 });
          this.isSaving = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      const req: PlanCreateRequest = { name, description, price: this.form.price, billingCycle: this.form.billingCycle, gracePeriodDays: this.form.gracePeriodDays };
      this.api.create(req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: item => {
          this.items = this.sort([...this.items, item]);
          this.selected = item;
          this.isSaving = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Plan creado.', life: 4000 });
          this.cdr.markForCheck();
        },
        error: err => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo crear el plan.'), life: 5000 });
          this.isSaving = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  clone(): void {
    if (!this.selected) return;
    this.isCloning = true;
    this.api.clone(this.selected.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.isCloning = false;
        this.closeDialog();
        this.msg.add({ severity: 'success', summary: 'Plan clonado', detail: `"${result.newPlanName}" creado. Actualiza la lista para verlo.`, life: 6000 });
        this.api.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: items => { this.items = this.sort(items); this.cdr.markForCheck(); }
        });
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo clonar.'), life: 5000 });
        this.isCloning = false;
        this.cdr.markForCheck();
      }
    });
  }

  askDelete(): void { this.confirmVisible = true; }
  cancelDelete(): void { this.confirmVisible = false; }

  confirmDelete(): void {
    if (!this.selected) return;
    this.isDeleting = true;
    this.api.delete(this.selected.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter(x => x.id !== this.selected!.id);
        this.isDeleting = false;
        this.confirmVisible = false;
        this.dialogVisible = false;
        this.selected = null;
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo eliminar el plan.'), life: 5000 });
        this.isDeleting = false;
        this.confirmVisible = false;
        this.cdr.markForCheck();
      }
    });
  }

  billingLabel(cycle: BillingCycle): string { return BILLING_LABELS[cycle] ?? cycle; }
  formatCurrency(v: number): string { return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', minimumFractionDigits: 0 }).format(v); }

  private sort(items: Plan[]): Plan[] {
    return [...items].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  private emptyForm() {
    return { name: '', description: '', price: 0, billingCycle: 'Monthly' as BillingCycle, gracePeriodDays: 5, isActive: true };
  }
}
