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
              <a *ngIf="r.comprobanteUrl" [href]="r.comprobanteUrl" target="_blank" class="row-link comp-link">
                <i class="pi pi-image"></i> Ver
              </a>
              <p-button *ngIf="r.status === 'PendingPayment' && !r.comprobanteUrl"
                        icon="pi pi-upload" size="small" [text]="true" severity="info"
                        pTooltip="Adjuntar comprobante" (onClick)="openComprobante(r)"></p-button>
              <p-button *ngIf="canReview(r)" icon="pi pi-check" size="small" [text]="true" severity="success"
                        pTooltip="Aprobar" (onClick)="review(r, true)"></p-button>
              <p-button *ngIf="canReview(r)" icon="pi pi-times" size="small" [text]="true" severity="danger"
                        pTooltip="Rechazar" (onClick)="openReject(r)"></p-button>
            </span>
          </div>
        </div>
      </div>
    </p-card>

    <!-- MODAL COMPROBANTE -->
    <div class="ov-backdrop" *ngIf="comprobanteVisible" (click)="closeComprobante()"></div>
    <div class="ov-panel comp-panel" *ngIf="comprobanteVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <div class="am-header-info">
          <div class="am-icon-badge" style="background:var(--blue-500)">
            <i class="pi pi-upload"></i>
          </div>
          <div class="am-header-text">
            <strong>Adjuntar comprobante</strong>
            <span class="am-subtitle" *ngIf="comprobanteReservation">
              {{ comprobanteReservation.amenityName }} — {{ comprobanteReservation.reservedByName }}
            </span>
          </div>
        </div>
        <button class="ov-close" (click)="closeComprobante()">✕</button>
      </div>

      <form class="am-form" (ngSubmit)="submitComprobante()">
        <div class="am-section">
          <div class="am-section-title">
            <i class="pi pi-link"></i>
            URL del comprobante de pago
          </div>
          <div class="am-field">
            <label class="am-label">Enlace al comprobante <span class="am-req">*</span></label>
            <input [(ngModel)]="comprobanteUrl" name="comprobanteUrl" type="url" required
                   class="am-input"
                   placeholder="https://drive.google.com/... o similar" />
            <div class="am-hint">
              <i class="pi pi-info-circle"></i>
              Pegá el link de la foto/captura del comprobante (Google Drive, Dropbox, etc.)
            </div>
          </div>
          <div class="comp-price-info" *ngIf="comprobanteReservation">
            <i class="pi pi-credit-card"></i>
            Monto a abonar: <strong>{{ formatCurrency(comprobanteReservation.price) }}</strong>
          </div>
        </div>

        <div class="am-footer">
          <p-button type="button" label="Cancelar" severity="secondary" [outlined]="true"
                    (onClick)="closeComprobante()"></p-button>
          <p-button type="submit" [loading]="isSavingComprobante" icon="pi pi-check"
                    label="Enviar comprobante"></p-button>
        </div>
      </form>
    </div>

    <!-- MODAL RECHAZO -->
    <div class="ov-backdrop" *ngIf="rejectVisible" (click)="closeReject()"></div>
    <div class="ov-panel reject-panel" *ngIf="rejectVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <div class="am-header-info">
          <div class="am-icon-badge" style="background:var(--red-500)">
            <i class="pi pi-times-circle"></i>
          </div>
          <div class="am-header-text">
            <strong>Rechazar reserva</strong>
            <span class="am-subtitle" *ngIf="pendingRejectReservation">
              {{ pendingRejectReservation.amenityName }} — {{ pendingRejectReservation.reservedByName }}
            </span>
          </div>
        </div>
        <button class="ov-close" (click)="closeReject()">✕</button>
      </div>
      <div class="am-form">
        <div class="am-section">
          <div class="am-section-title">
            <i class="pi pi-comment"></i>
            Motivo del rechazo
          </div>
          <div class="am-field">
            <div class="am-label-row">
              <label class="am-label">Motivo</label>
              <span class="am-opt-badge">opcional</span>
            </div>
            <textarea [(ngModel)]="rejectReason" name="rejectReason" maxlength="500"
                      class="am-textarea" rows="3"
                      placeholder="Ej: El espacio no está disponible por mantenimiento…"></textarea>
            <div class="am-hint">Este motivo le será notificado al solicitante.</div>
          </div>
        </div>
        <div class="am-footer">
          <p-button type="button" label="Cancelar" severity="secondary" [outlined]="true"
                    (onClick)="closeReject()"></p-button>
          <p-button type="button" icon="pi pi-times" label="Confirmar rechazo" severity="danger"
                    (onClick)="confirmReject()"></p-button>
        </div>
      </div>
    </div>

    <!-- BACKDROP + PANEL -->
    <div class="ov-backdrop" *ngIf="dialogVisible" (click)="closeDialog()"></div>
    <div class="ov-panel am-panel" *ngIf="dialogVisible" (click)="$event.stopPropagation()">

      <!-- Header mejorado -->
      <div class="ov-header">
        <div class="am-header-info">
          <div class="am-icon-badge">
            <i class="pi pi-building"></i>
          </div>
          <div class="am-header-text">
            <strong>{{ selected ? 'Editar amenity' : 'Nuevo amenity' }}</strong>
            <span class="am-subtitle" *ngIf="selected">{{ selected.name }}</span>
          </div>
        </div>
        <button class="ov-close" (click)="closeDialog()">✕</button>
      </div>

      <form class="am-form" (ngSubmit)="save()">

        <!-- Sección: Información básica -->
        <div class="am-section">
          <div class="am-section-title">
            <i class="pi pi-info-circle"></i>
            Información básica
          </div>

          <div class="am-field" *ngIf="!selected">
            <label class="am-label">Edificio <span class="am-req">*</span></label>
            <select [(ngModel)]="form.buildingId" name="buildingId" class="am-select" required>
              <option value="" disabled>— Seleccionar edificio —</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
          </div>

          <div class="am-field">
            <label class="am-label">Nombre <span class="am-req">*</span></label>
            <input [(ngModel)]="form.name" name="name" required maxlength="150"
                   class="am-input" placeholder="Ej: Quincho, Piscina, Salón de fiestas" />
          </div>

          <div class="am-field">
            <div class="am-label-row">
              <label class="am-label">Descripción</label>
              <span class="am-opt-badge">opcional</span>
            </div>
            <textarea [(ngModel)]="form.description" name="description" maxlength="1000"
                      class="am-textarea" rows="3"
                      placeholder="Capacidad, reglas de uso, equipamiento disponible…"></textarea>
            <div class="am-hint">{{ (form.description || '').length }} / 1000 caracteres</div>
          </div>
        </div>

        <!-- Sección: Precio -->
        <div class="am-section">
          <div class="am-section-title">
            <i class="pi pi-dollar"></i>
            Precio de reserva
          </div>

          <div class="am-field">
            <label class="am-label">Monto por reserva <span class="am-req">*</span></label>
            <div class="am-price-wrap">
              <span class="am-price-prefix">Gs.</span>
              <input [(ngModel)]="form.reservationPrice" name="reservationPrice"
                     type="number" min="0" step="1000" required class="am-input am-price-input" />
            </div>
            <div class="am-hint">Ingresá <strong>0</strong> si la reserva es gratuita.</div>
          </div>
        </div>

        <!-- Sección: Visibilidad -->
        <div class="am-section">
          <div class="am-section-title">
            <i class="pi pi-eye"></i>
            Visibilidad
          </div>

          <div class="am-toggle-row">
            <div class="am-toggle-info">
              <div class="am-label" style="margin-bottom:0.2rem">Estado del amenity</div>
              <div class="am-hint" style="margin-top:0">
                <ng-container *ngIf="form.isActive">
                  <i class="pi pi-check-circle" style="color:var(--green-500)"></i>
                  Visible y reservable por los residentes
                </ng-container>
                <ng-container *ngIf="!form.isActive">
                  <i class="pi pi-ban" style="color:var(--red-400)"></i>
                  Oculto — los residentes no podrán reservarlo
                </ng-container>
              </div>
            </div>
            <label class="am-toggle" [class.am-toggle--on]="form.isActive">
              <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" class="am-toggle-input" />
              <span class="am-toggle-track">
                <span class="am-toggle-thumb"></span>
              </span>
            </label>
          </div>
        </div>

        <!-- Footer -->
        <div class="am-footer">
          <p-button *ngIf="selected" type="button" label="Eliminar" icon="pi pi-trash"
                    severity="danger" [outlined]="true" (onClick)="remove()"></p-button>
          <p-button type="submit" [loading]="isSaving" icon="pi pi-check"
                    [label]="selected ? 'Guardar cambios' : 'Crear amenity'"></p-button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    /* ── Lista / filtros ───────────────────────────────────────── */
    .filter-bar { display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; }
    .filter-bar select, .app-toolbar select {
      padding:0.4rem 0.6rem;
      border:1px solid var(--surface-border);
      border-radius:6px;
      background:var(--surface-ground);
      color:var(--text-color);
    }
    .amenity-grid { grid-template-columns: 2fr 1.2fr 1fr 0.8fr; }
    .reservation-grid { grid-template-columns: 1.4fr 1.4fr 1.1fr 1.1fr 0.9fr 0.9fr 1fr; }
    .reservations-section { margin-top:2rem; }
    .reservations-section h2 { margin:0; font-size:1.1rem; }
    .actions { display:flex; align-items:center; gap:0.25rem; }

    /* ── Panel overlay ─────────────────────────────────────────── */
    .am-panel { width:480px; max-width:96vw; }

    /* ── Header ────────────────────────────────────────────────── */
    .am-header-info { display:flex; align-items:center; gap:0.75rem; flex:1; min-width:0; }
    .am-icon-badge {
      width:40px; height:40px; border-radius:10px;
      background:var(--primary-color);
      color:#fff;
      display:flex; align-items:center; justify-content:center;
      font-size:1.15rem;
      flex-shrink:0;
    }
    .am-header-text { display:flex; flex-direction:column; }
    .am-subtitle {
      font-size:0.78rem;
      color:var(--text-color-secondary);
      font-weight:400;
      margin-top:0.1rem;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }

    /* ── Form wrapper ──────────────────────────────────────────── */
    .am-form { display:flex; flex-direction:column; gap:0; }

    /* ── Sección ───────────────────────────────────────────────── */
    .am-section {
      border:1px solid var(--surface-border);
      border-radius:10px;
      padding:1rem 1.1rem;
      margin:0.85rem 1.25rem 0;
      display:flex;
      flex-direction:column;
      gap:0.9rem;
    }
    .am-section-title {
      font-size:0.71rem;
      font-weight:700;
      text-transform:uppercase;
      letter-spacing:0.06em;
      color:var(--text-color-secondary);
      display:flex;
      align-items:center;
      gap:0.35rem;
      padding-bottom:0.6rem;
      border-bottom:1px solid var(--surface-border);
    }

    /* ── Campo ─────────────────────────────────────────────────── */
    .am-field { display:flex; flex-direction:column; gap:0.3rem; }
    .am-label-row { display:flex; align-items:center; gap:0.5rem; }
    .am-label {
      font-size:0.84rem;
      font-weight:600;
      color:var(--text-color);
    }
    .am-req { color:var(--red-400); }
    .am-opt-badge {
      font-size:0.7rem;
      font-weight:500;
      background:var(--surface-hover);
      color:var(--text-color-secondary);
      border-radius:4px;
      padding:0.1rem 0.4rem;
    }
    .am-hint {
      font-size:0.78rem;
      color:var(--text-color-secondary);
      display:flex;
      align-items:center;
      gap:0.3rem;
    }

    /* ── Inputs ────────────────────────────────────────────────── */
    .am-input, .am-select, .am-textarea {
      border:1.5px solid var(--surface-border);
      border-radius:8px;
      padding:0.52rem 0.75rem;
      font-size:0.9rem;
      color:var(--text-color);
      background:var(--surface-ground);
      font-family:inherit;
      transition:border-color 0.15s, box-shadow 0.15s;
      outline:none;
      width:100%;
      box-sizing:border-box;
    }
    .am-input:focus, .am-select:focus, .am-textarea:focus {
      border-color:var(--primary-color);
      box-shadow:0 0 0 3px rgba(0,0,0,0.06);
    }
    .am-textarea { resize:vertical; min-height:80px; line-height:1.5; }
    .am-select { cursor:pointer; }

    /* ── Precio ────────────────────────────────────────────────── */
    .am-price-wrap { display:flex; align-items:stretch; }
    .am-price-prefix {
      background:var(--surface-hover);
      border:1.5px solid var(--surface-border);
      border-right:none;
      border-radius:8px 0 0 8px;
      padding:0.52rem 0.75rem;
      font-size:0.85rem;
      font-weight:700;
      color:var(--text-color-secondary);
      display:flex;
      align-items:center;
      white-space:nowrap;
    }
    .am-price-input { border-radius:0 8px 8px 0 !important; flex:1; }
    .am-price-wrap:focus-within .am-price-prefix { border-color:var(--primary-color); }

    /* ── Toggle ────────────────────────────────────────────────── */
    .am-toggle-row { display:flex; align-items:center; gap:1rem; }
    .am-toggle-info { flex:1; }
    .am-toggle { cursor:pointer; display:inline-block; user-select:none; flex-shrink:0; }
    .am-toggle-input { position:absolute; opacity:0; pointer-events:none; width:0; height:0; }
    .am-toggle-track {
      display:block;
      width:46px; height:26px;
      border-radius:13px;
      background:var(--surface-border);
      position:relative;
      transition:background 0.2s;
    }
    .am-toggle--on .am-toggle-track { background:var(--primary-color); }
    .am-toggle-thumb {
      position:absolute;
      top:4px; left:4px;
      width:18px; height:18px;
      border-radius:50%;
      background:#fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.25);
      transition:transform 0.2s;
    }
    .am-toggle--on .am-toggle-thumb { transform:translateX(20px); }

    /* ── Footer ────────────────────────────────────────────────── */
    .am-footer {
      display:flex;
      justify-content:flex-end;
      align-items:center;
      gap:0.75rem;
      padding:1rem 1.25rem;
      margin-top:0.85rem;
      border-top:1px solid var(--surface-border);
    }
    .am-footer p-button:first-child { margin-right:auto; }

    /* ── Comprobante modal ─────────────────────────────────────── */
    .comp-panel { width:460px; max-width:96vw; }

    /* ── Rechazo modal ─────────────────────────────────────────── */
    .reject-panel { width:460px; max-width:96vw; }
    .comp-link { display:inline-flex; align-items:center; gap:0.25rem; font-size:0.82rem; }
    .comp-price-info {
      display:flex;
      align-items:center;
      gap:0.5rem;
      padding:0.6rem 0.75rem;
      background:var(--blue-50, #eff6ff);
      border:1px solid var(--blue-200, #bfdbfe);
      border-radius:8px;
      font-size:0.85rem;
      color:var(--blue-800, #1e40af);
    }
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

  comprobanteVisible = false;
  comprobanteReservation: AmenityReservation | null = null;
  comprobanteUrl = '';
  isSavingComprobante = false;

  rejectVisible = false;
  pendingRejectReservation: AmenityReservation | null = null;
  rejectReason = '';

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
    if (this.isSaving) return;
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

  openComprobante(r: AmenityReservation): void {
    this.comprobanteReservation = r;
    this.comprobanteUrl = '';
    this.comprobanteVisible = true;
  }

  closeComprobante(): void { this.comprobanteVisible = false; this.comprobanteReservation = null; }

  submitComprobante(): void {
    if (this.isSavingComprobante || !this.comprobanteReservation) return;
    if (!this.comprobanteUrl.trim()) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La URL del comprobante es obligatoria.', life: 5000 });
      return;
    }
    this.isSavingComprobante = true;
    this.api.submitComprobante(this.comprobanteReservation.id, { comprobanteUrl: this.comprobanteUrl.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.reservations = this.reservations.map(x => x.id === updated.id ? updated : x);
          this.applyFilters();
          this.isSavingComprobante = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Comprobante enviado. La reserva queda pendiente de revisión.', life: 5000 });
          this.closeComprobante();
          this.cdr.markForCheck();
        },
        error: err => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo enviar el comprobante.'), life: 5000 });
          this.isSavingComprobante = false;
          this.cdr.markForCheck();
        }
      });
  }

  canReview(r: AmenityReservation): boolean {
    return r.status === 'PendingPayment' || r.status === 'PendingReview';
  }

  review(r: AmenityReservation, approve: boolean): void {
    this.api.review(r.id, approve, undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.reservations = this.reservations.map(x => x.id === updated.id ? updated : x);
        this.applyFilters();
        this.msg.add({ severity: 'success', summary: 'Éxito',
          detail: 'Reserva confirmada. Se publicó el comunicado para el edificio.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: err => this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo procesar.'), life: 5000 })
    });
  }

  openReject(r: AmenityReservation): void {
    this.pendingRejectReservation = r;
    this.rejectReason = '';
    this.rejectVisible = true;
  }

  closeReject(): void {
    this.rejectVisible = false;
    this.pendingRejectReservation = null;
    this.rejectReason = '';
  }

  confirmReject(): void {
    if (!this.pendingRejectReservation) return;
    const r = this.pendingRejectReservation;
    const reason = this.rejectReason.trim() || undefined;
    this.closeReject();
    this.api.review(r.id, false, reason).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.reservations = this.reservations.map(x => x.id === updated.id ? updated : x);
        this.applyFilters();
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Reserva rechazada.', life: 4000 });
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
