import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Supplier, SupplierPage } from '../../api/building-config.models';
import { SuppliersApiService } from '../../api/suppliers-api.service';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

const PAGE_SIZE = 25;

type StatusFilter = 'all' | 'active' | 'inactive';

// Proveedores de la empresa (compartidos entre sus edificios): nombre, RUC con dígito verificador, contacto y plazo de pago habitual. Al cargar
// un gasto se elige el proveedor de esta lista; uno con gastos no se elimina, se desactiva. Los ven y editan SuperAdmin, Administrador,
// Operador y Encargado.
@Component({
  standalone: true,
  selector: 'app-config-suppliers-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Message, Tag],
  template: `
    <h2>Proveedores</h2>
    <p class="muted small">Lista de la empresa, compartida entre todos sus edificios. Al cargar un gasto se elige de acá y el vencimiento se propone con el plazo de pago.</p>

    <p-message *ngIf="!companyId" severity="info" text="El edificio no tiene empresa asignada: no hay proveedores para mostrar."></p-message>
    <p-message *ngIf="error" severity="error" [text]="error"></p-message>

    <ng-container *ngIf="companyId">
      <div class="toolbar">
        <label class="field search">
          <span>Buscar</span>
          <input type="search" placeholder="Nombre o RUC" [(ngModel)]="query" (ngModelChange)="onSearch()" />
        </label>
        <label class="field">
          <span>Estado</span>
          <select [(ngModel)]="status" (ngModelChange)="reload()">
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Desactivados</option>
          </select>
        </label>
        <button type="button" class="btn" *ngIf="canEdit" (click)="startCreate()">Nuevo proveedor</button>
      </div>

      <form class="panel" *ngIf="editing" (ngSubmit)="save()">
        <h3>{{ editing.id ? 'Editar proveedor' : 'Nuevo proveedor' }}</h3>
        <div class="form">
          <label class="field wide">
            <span>Nombre *</span>
            <input type="text" name="name" maxlength="200" [(ngModel)]="form.name" required />
          </label>
          <label class="field">
            <span>RUC</span>
            <input type="text" name="ruc" maxlength="20" [(ngModel)]="form.ruc" placeholder="80012345-6" />
            <span class="hint">Con guion y dígito verificador. No se repite dentro de la empresa.</span>
          </label>
          <label class="field">
            <span>Plazo de pago habitual (días)</span>
            <input type="number" name="term" min="0" max="365" step="1" [(ngModel)]="form.paymentTermDays" />
          </label>
          <label class="field">
            <span>Teléfono</span>
            <input type="text" name="phone" maxlength="40" [(ngModel)]="form.phone" />
          </label>
          <label class="field">
            <span>Correo</span>
            <input type="email" name="email" maxlength="160" [(ngModel)]="form.email" />
          </label>
          <label class="field wide">
            <span>Dirección</span>
            <input type="text" name="address" maxlength="300" [(ngModel)]="form.address" />
          </label>
          <label class="check wide"><input type="checkbox" name="isActive" [(ngModel)]="form.isActive" /> Proveedor activo</label>
        </div>
        <div class="actions">
          <button type="submit" class="btn" [disabled]="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
          <button type="button" class="btn secondary" (click)="cancel()">Cancelar</button>
        </div>
      </form>

      <p class="app-state" *ngIf="loading">Cargando...</p>
      <p class="muted" *ngIf="!loading && data && !data.items.length">No hay proveedores con esos filtros.</p>

      <div class="table-wrap" *ngIf="data?.items?.length">
        <table class="t">
          <thead><tr><th>Nombre</th><th>RUC</th><th>Contacto</th><th class="num">Plazo</th><th class="num">Gastos</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let s of data!.items" [class.inactive]="!s.isActive">
              <td><strong>{{ s.name }}</strong><div class="muted small" *ngIf="s.address">{{ s.address }}</div></td>
              <td class="nowrap">{{ s.ruc || '—' }}</td>
              <td>
                <div *ngIf="s.phone">{{ s.phone }}</div>
                <div class="muted small" *ngIf="s.email">{{ s.email }}</div>
                <span *ngIf="!s.phone && !s.email" class="muted">—</span>
              </td>
              <td class="num">{{ s.paymentTermDays !== null ? s.paymentTermDays + ' días' : '—' }}</td>
              <td class="num">{{ s.expenseCount }}</td>
              <td><p-tag [value]="s.isActive ? 'Activo' : 'Desactivado'" [severity]="s.isActive ? 'success' : 'secondary'"></p-tag></td>
              <td class="num"><button type="button" class="btn sm secondary" *ngIf="canEdit" (click)="startEdit(s)">Editar</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pager" *ngIf="data && data.totalCount > data.pageSize">
        <button type="button" class="btn sm secondary" [disabled]="page <= 1" (click)="go(page - 1)">Anterior</button>
        <span class="muted">Página {{ page }} de {{ pages }} · {{ data.totalCount }} proveedores</span>
        <button type="button" class="btn sm secondary" [disabled]="page >= pages" (click)="go(page + 1)">Siguiente</button>
      </div>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .toolbar { display: flex; gap: 0.9rem; align-items: flex-end; flex-wrap: wrap; margin: 0.8rem 0 1rem; }
    .search { min-width: 14rem; }
    .panel { border: 1px solid var(--brand-border); border-radius: 14px; padding: 0.4rem 1.1rem 1rem; margin-bottom: 1rem; background: var(--p-content-background, #fff); }
    .panel h3 { margin-top: 0.8rem; }
    .check.wide { grid-column: 1 / -1; }
    tr.inactive td { opacity: 0.65; }
    .pager { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1rem; }
  `]
})
export class ConfigSuppliersSectionComponent implements OnChanges {
  private readonly api = inject(SuppliersApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  // Empresa del edificio abierto: los proveedores son de la empresa. El SuperAdmin la necesita para ver y crear.
  @Input() companyId = '';

  data: SupplierPage | null = null;
  query = '';
  status: StatusFilter = 'all';
  page = 1;
  loading = false;
  saving = false;
  error = '';
  editing: { id: string | null } | null = null;
  form = this.emptyForm();
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  get canEdit(): boolean { return this.data?.canEdit ?? false; }
  get pages(): number { return this.data ? Math.max(Math.ceil(this.data.totalCount / this.data.pageSize), 1) : 1; }

  private emptyForm() {
    return { name: '', ruc: '', phone: '', email: '', address: '', paymentTermDays: null as number | null, isActive: true };
  }

  ngOnChanges(): void {
    this.editing = null;
    this.page = 1;
    this.load();
  }

  // Busca al dejar de escribir (no una consulta por tecla).
  onSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reload(), 350);
  }

  reload(): void {
    this.page = 1;
    this.load();
  }

  go(page: number): void {
    this.page = page;
    this.load();
  }

  startCreate(): void {
    this.editing = { id: null };
    this.form = this.emptyForm();
  }

  startEdit(s: Supplier): void {
    this.editing = { id: s.id };
    this.form = {
      name: s.name, ruc: s.ruc ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '',
      paymentTermDays: s.paymentTermDays, isActive: s.isActive
    };
  }

  cancel(): void {
    this.editing = null;
  }

  save(): void {
    const f = this.form;
    if (!f.name.trim()) {
      this.msg.add({ severity: 'warn', summary: 'Revisá los datos', detail: 'El nombre del proveedor es obligatorio.', life: 5000 });
      return;
    }

    if (f.paymentTermDays !== null && (f.paymentTermDays < 0 || f.paymentTermDays > 365)) {
      this.msg.add({ severity: 'warn', summary: 'Revisá los datos', detail: 'El plazo de pago debe estar entre 0 y 365 días.', life: 5000 });
      return;
    }

    const request = {
      companyId: this.companyId || null,
      name: f.name.trim(),
      ruc: f.ruc.trim() || null,
      phone: f.phone.trim() || null,
      email: f.email.trim() || null,
      address: f.address.trim() || null,
      paymentTermDays: f.paymentTermDays,
      isActive: f.isActive
    };

    this.saving = true;
    const id = this.editing?.id ?? null;
    (id ? this.api.update(id, request) : this.api.create(request)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.saving = false;
        this.editing = null;
        this.msg.add({ severity: 'success', summary: id ? 'Proveedor actualizado' : 'Proveedor creado', detail: saved.name, life: 3500 });
        this.load();
      },
      error: err => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: extractApiErrorMessage(err, 'No se pudo guardar el proveedor.'), life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  private load(): void {
    if (!this.companyId) return;

    this.loading = true;
    this.error = '';
    this.api.getAll({
      companyId: this.companyId,
      q: this.query.trim() || undefined,
      isActive: this.status === 'all' ? undefined : this.status === 'active',
      page: this.page,
      pageSize: PAGE_SIZE
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.data = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudieron cargar los proveedores.');
        this.cdr.markForCheck();
      }
    });
  }
}
