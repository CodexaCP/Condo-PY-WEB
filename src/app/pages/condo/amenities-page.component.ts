import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { AmenitiesApiService } from '../../api/amenities-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { Amenity, AmenityReservation, AmenityReservationStatus, Building } from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-amenities-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Amenities</h1>
            <p>Espacios comunes reservables del edificio: quincho, piscina, salón de fiestas, etc.</p>
          </div>
        </div>
        <p-button label="Nuevo amenity" icon="pi pi-plus" (onClick)="openCreate()"></p-button>
      </div>

      <div class="filter-bar" *ngIf="buildings.length > 1">
        <label class="filter-label">Edificio:</label>
        <select [(ngModel)]="filterBuildingId" (ngModelChange)="applyFilters()">
          <option value="">Todos los edificios</option>
          <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
        </select>
      </div>

      <p class="app-state" *ngIf="loading">Cargando amenities...</p>
      <p class="app-state" *ngIf="!loading && !filteredAmenities.length">No hay amenities registrados.</p>

      <div class="app-list" *ngIf="filteredAmenities.length">
        <div class="app-row header amenity-grid">
          <span>Nombre</span>
          <span *ngIf="buildings.length > 1">Edificio</span>
          <span>Precio reserva</span>
          <span>Estado</span>
        </div>
        <div class="app-row amenity-grid" *ngFor="let item of filteredAmenities">
          <button class="row-link" (click)="openEdit(item)">{{ item.name }}</button>
          <span *ngIf="buildings.length > 1">{{ item.buildingName }}</span>
          <span>{{ formatCurrency(item.reservationPrice) }}</span>
          <p-tag [value]="item.isActive ? 'Activo' : 'Inactivo'" [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        </div>
      </div>

      <!-- Reservas -->
      <div class="reservations-section">
        <div class="app-toolbar">
          <h2>Reservas</h2>
          <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()">
            <option value="">Todas</option>
            <option value="PendingPayment">Pendiente de pago</option>
            <option value="PendingReview">Pendiente de revisión</option>
            <option value="Confirmed">Confirmadas</option>
            <option value="Rejected">Rechazadas</option>
            <option value="Cancelled">Canceladas</option>
          </select>
        </div>

        <p class="app-state" *ngIf="!filteredReservations.length">No hay reservas para mostrar.</p>

        <div class="app-list" *ngIf="filteredReservations.length">
          <div class="app-row header reservation-grid">
            <span>Amenity</span>
            <span>Reservó</span>
            <span>Desde</span>
            <span>Hasta</span>
            <span>Precio</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>
          <div class="app-row reservation-grid" *ngFor="let r of filteredReservations">
            <span>{{ r.amenityName }}</span>
            <span>{{ r.reservedByName }}</span>
            <span>{{ formatDateTime(r.startsAt) }}</span>
            <span>{{ formatDateTime(r.endsAt) }}</span>
            <span>{{ formatCurrency(r.price) }}</span>
            <p-tag [value]="statusLabel(r.status)" [severity]="statusSeverity(r.status)"></p-tag>
            <span class="actions">
              <a *ngIf="r.comprobanteUrl" [href]="r.comprobanteUrl" target="_blank" class="row-link">Comprobante</a>
              <p-button *ngIf="canReview(r)" icon="pi pi-check" size="small" [text]="true" severity="success"
                        pTooltip="Aprobar" (onClick)="review(r, true)"></p-button>
              <p-button *ngIf="canReview(r)" icon="pi pi-times" size="small" [text]="true" severity="danger"
                        pTooltip="Rechazar" (onClick)="review(r, false)"></p-button>
            </span>
          </div>
        </div>
      </div>
    </p-card>

    <!-- BACKDROP + PANEL -->
    <div class="ov-backdrop" *ngIf="dialogVisible" (click)="closeDialog()"></div>
    <div class="ov-panel" *ngIf="dialogVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ selected ? selected.name : 'Nuevo amenity' }}</strong>
        <button class="ov-close" (click)="closeDialog()">✕</button>
      </div>
      <form class="ficha-form" (ngSubmit)="save()">
        <label *ngIf="!selected">
          <span>Edificio</span>
          <select [(ngModel)]="form.buildingId" name="buildingId" required>
            <option value="" disabled>— Seleccionar edificio —</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </label>
        <label>
          <span>Nombre</span>
          <input [(ngModel)]="form.name" name="name" required maxlength="150" placeholder="Ej: Quincho, Piscina, Salón de fiestas" />
        </label>
        <label>
          <span>Descripción <small>(opcional)</small></span>
          <input [(ngModel)]="form.description" name="description" maxlength="1000" />
        </label>
        <label>
          <span>Precio de reserva (Gs.)</span>
          <input [(ngModel)]="form.reservationPrice" name="reservationPrice" type="number" min="0" step="1000" required />
          <small>Monto que paga el usuario por reservar. 0 = gratis.</small>
        </label>
        <label class="checkbox">
          <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" />
          <span>Amenity activo (visible para reservar)</span>
        </label>
        <div class="ficha-footer">
          <p-button type="submit" [loading]="isSaving" [label]="selected ? 'Guardar cambios' : 'Crear amenity'"></p-button>
          <p-button *ngIf="selected" type="button" label="Eliminar" severity="danger" [outlined]="true" (onClick)="remove()"></p-button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .filter-bar { display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; }
    .filter-bar select, .app-toolbar select { padding:0.4rem 0.6rem; border:1px solid var(--surface-border); border-radius:6px; }
    .amenity-grid { grid-template-columns: 2fr 1.2fr 1fr 0.8fr; }
    .reservation-grid { grid-template-columns: 1.4fr 1.4fr 1.1fr 1.1fr 0.9fr 0.9fr 1fr; }
    .reservations-section { margin-top: 2rem; }
    .reservations-section h2 { margin: 0; font-size: 1.1rem; }
    .actions { display:flex; align-items:center; gap:0.25rem; }
  `]
})
export class AmenitiesPageComponent implements OnInit {
  private readonly api = inject(AmenitiesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly msg = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  buildings: Building[] = [];
  amenities: Amenity[] = [];
  reservations: AmenityReservation[] = [];
  filteredAmenities: Amenity[] = [];
  filteredReservations: AmenityReservation[] = [];
  filterBuildingId = '';
  filterStatus = '';
  loading = true;
  isSaving = false;
  dialogVisible = false;
  selected: Amenity | null = null;
  form = this.emptyForm();

  ngOnInit(): void { this.loadData(); }

  loadData(): void {
    this.loading = true;
    forkJoin({
      buildings: this.buildingsApi.getAll(),
      amenities: this.api.getAll(),
      reservations: this.api.getReservations()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ buildings, amenities, reservations }) => {
        this.buildings = buildings;
        this.amenities = amenities;
        this.reservations = reservations;
        this.applyFilters();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudieron cargar los amenities.'), life: 5000 });
        this.loading = false; this.cdr.markForCheck();
      }
    });
  }

  applyFilters(): void {
    this.filteredAmenities = this.filterBuildingId
      ? this.amenities.filter(x => x.buildingId === this.filterBuildingId)
      : this.amenities;
    this.filteredReservations = this.reservations.filter(r =>
      (!this.filterBuildingId || r.buildingId === this.filterBuildingId) &&
      (!this.filterStatus || r.status === this.filterStatus));
  }

  openCreate(): void { this.selected = null; this.form = this.emptyForm(); this.dialogVisible = true; }

  openEdit(item: Amenity): void {
    this.selected = item;
    this.form = { buildingId: item.buildingId, name: item.name, description: item.description,
                  reservationPrice: item.reservationPrice, isActive: item.isActive };
    this.dialogVisible = true;
  }

  closeDialog(): void { this.dialogVisible = false; this.selected = null; }

  save(): void {
    if (!this.form.buildingId) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El edificio es obligatorio.', life: 5000 }); return; }
    if (!this.form.name.trim()) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre es obligatorio.', life: 5000 }); return; }
    if (this.form.reservationPrice < 0) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El precio no puede ser negativo.', life: 5000 }); return; }

    this.isSaving = true;
    const req = { buildingId: this.form.buildingId, name: this.form.name.trim(),
                  description: this.form.description.trim(), reservationPrice: this.form.reservationPrice,
                  isActive: this.form.isActive };
    const op = this.selected ? this.api.update(this.selected.id, req) : this.api.create(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: item => {
        this.amenities = this.selected
          ? this.amenities.map(x => x.id === item.id ? item : x)
          : [...this.amenities, item];
        this.applyFilters();
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.selected ? 'Amenity actualizado.' : 'Amenity creado.', life: 4000 });
        this.closeDialog(); this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar.'), life: 5000 });
        this.isSaving = false; this.cdr.markForCheck();
      }
    });
  }

  remove(): void {
    if (!this.selected) return;
    this.api.delete(this.selected.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.amenities = this.amenities.filter(x => x.id !== this.selected!.id);
        this.applyFilters(); this.closeDialog(); this.cdr.markForCheck();
      },
      error: err => this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo eliminar.'), life: 5000 })
    });
  }

  canReview(r: AmenityReservation): boolean {
    return r.status === 'PendingPayment' || r.status === 'PendingReview';
  }

  review(r: AmenityReservation, approve: boolean): void {
    const rejectionReason = approve ? undefined : (prompt('Motivo del rechazo (opcional):') ?? undefined);
    this.api.review(r.id, approve, rejectionReason).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.reservations = this.reservations.map(x => x.id === updated.id ? updated : x);
        this.applyFilters();
        this.msg.add({ severity: 'success', summary: 'Éxito',
          detail: approve ? 'Reserva confirmada. Se publicó el comunicado para el edificio.' : 'Reserva rechazada.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: err => this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo procesar.'), life: 5000 })
    });
  }

  statusLabel(status: AmenityReservationStatus): string {
    return ({ PendingPayment: 'Pendiente de pago', PendingReview: 'Pendiente de revisión',
              Confirmed: 'Confirmada', Rejected: 'Rechazada', Cancelled: 'Cancelada' })[status] ?? status;
  }

  statusSeverity(status: AmenityReservationStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    return ({ PendingPayment: 'warn', PendingReview: 'info', Confirmed: 'success',
              Rejected: 'danger', Cancelled: 'secondary' } as const)[status] ?? 'secondary';
  }

  formatCurrency(value: number): string { return `Gs. ${Math.round(value).toLocaleString('es-PY')}`; }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private emptyForm() {
    return { buildingId: '', name: '', description: '', reservationPrice: 0, isActive: true };
  }
}
