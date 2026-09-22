import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { InvoiceSeriesApiService } from '../../api/invoice-series-api.service';
import { AuthService } from '../../auth/auth.service';
import { Building, InvoiceSeries, InvoiceSeriesDocumentType } from '../../api/models';

@Component({
  standalone: true,
  selector: 'app-invoice-series-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Timbrados</h1>
            <p>Configuración de numeración fiscal por edificio para la emisión de facturas.</p>
          </div>
        </div>

        <p-button
          *ngIf="canManage"
          [label]="showForm ? 'Cerrar formulario' : 'Nuevo timbrado'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <div class="filters-bar">
        <span class="pi pi-filter filters-icon"></span>
        <div class="field-block">
          <span>Edificio</span>
          <select [(ngModel)]="filterBuildingId" name="filterBuildingId" (ngModelChange)="applyFilters()">
            <option value="">Todos</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <div class="field-block">
          <span>Tipo de documento</span>
          <select [(ngModel)]="filterDocumentType" name="filterDocumentType" (ngModelChange)="applyFilters()">
            <option value="">Todos</option>
            <option value="Invoice">Factura</option>
            <option value="CreditNote">Nota de crédito</option>
          </select>
        </div>
      </div>

      <!-- Form -->
      <form class="panel-box form-panel" *ngIf="showForm" (ngSubmit)="submit()">
        <div class="panel-box-title">
          <span class="pi pi-receipt"></span>
          Nuevo timbrado
        </div>

        <div class="series-form">
          <div class="field-block">
            <span>Edificio <em>*</em></span>
            <select [(ngModel)]="form.buildingId" name="buildingId" required>
              <option value="" disabled>— Seleccionar —</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="field-block">
            <span>Tipo de documento <em>*</em></span>
            <select [(ngModel)]="form.documentType" name="documentType" required>
              <option value="Invoice">Factura</option>
              <option value="CreditNote">Nota de crédito</option>
            </select>
          </div>
          <div class="field-block">
            <span>RUC <em>*</em></span>
            <input [(ngModel)]="form.ruc" name="ruc" type="text" maxlength="20" placeholder="Ej: 80012345-6" required />
          </div>
          <div class="field-block wide2">
            <span>Razón social <em>*</em></span>
            <input [(ngModel)]="form.razonSocial" name="razonSocial" type="text" maxlength="200" placeholder="Nombre legal del emisor" required />
          </div>
          <div class="field-block">
            <span>Establecimiento <em>*</em></span>
            <input [(ngModel)]="form.establecimiento" name="establecimiento" type="text" maxlength="3" placeholder="001" required />
          </div>
          <div class="field-block">
            <span>Punto de expedición <em>*</em></span>
            <input [(ngModel)]="form.puntoExpedicion" name="puntoExpedicion" type="text" maxlength="3" placeholder="001" required />
          </div>
          <div class="field-block">
            <span>N° de timbrado <em>*</em></span>
            <input [(ngModel)]="form.numeroTimbrado" name="numeroTimbrado" type="text" maxlength="20" placeholder="12345678" required />
          </div>
          <div class="field-block">
            <span>Rango desde <em>*</em></span>
            <input [(ngModel)]="form.rangoDesde" name="rangoDesde" type="number" min="1" required />
          </div>
          <div class="field-block">
            <span>Rango hasta <em>*</em></span>
            <input [(ngModel)]="form.rangoHasta" name="rangoHasta" type="number" min="1" required />
          </div>
          <div class="field-block">
            <span>Vigencia desde <em>*</em></span>
            <input [(ngModel)]="form.vigenciaDesde" name="vigenciaDesde" type="date" required />
          </div>
          <div class="field-block">
            <span>Vigencia hasta <em>*</em></span>
            <input [(ngModel)]="form.vigenciaHasta" name="vigenciaHasta" type="date" required />
          </div>
        </div>

        <div class="form-footer">
          <div class="form-actions">
            <p-button type="submit" [loading]="isSaving" icon="pi pi-check" label="Guardar timbrado"></p-button>
          </div>
        </div>
      </form>

      <p class="app-state" *ngIf="loading">Cargando timbrados...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay timbrados cargados.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header series-grid">
          <span>Edificio</span>
          <span>Tipo</span>
          <span>Timbrado</span>
          <span>Rango</span>
          <span>Disponibles</span>
          <span>Vigencia</span>
          <span>Estado</span>
          <span class="actions-head" *ngIf="canManage">Acciones</span>
        </div>

        <div class="app-row series-grid" *ngFor="let item of items">
          <span>
            {{ item.buildingName }}
            <small class="sub-text">{{ item.razonSocial }} · RUC {{ item.ruc }}</small>
          </span>
          <p-tag [value]="item.documentType === 'CreditNote' ? 'Nota de crédito' : 'Factura'"
                 [severity]="item.documentType === 'CreditNote' ? 'info' : 'secondary'"></p-tag>
          <span>{{ item.establecimiento }}-{{ item.puntoExpedicion }}-{{ item.numeroTimbrado }}</span>
          <span>{{ item.correlativoActual }} / {{ item.rangoHasta }}</span>
          <span [class.warn-text]="item.proximoAAgotarse">
            {{ item.numerosDisponibles }}
            <p-tag *ngIf="item.proximoAAgotarse" value="Por agotarse" severity="warn" styleClass="ml-2"></p-tag>
          </span>
          <span [class.warn-text]="item.proximoAVencer">
            {{ item.vigenciaDesde }} — {{ item.vigenciaHasta }}
            <p-tag *ngIf="item.proximoAVencer" value="Por vencer" severity="warn" styleClass="ml-2"></p-tag>
          </span>
          <p-tag [value]="item.activo ? 'Activo' : 'Inactivo'" [severity]="item.activo ? 'success' : 'secondary'"></p-tag>
          <div class="app-actions" *ngIf="canManage">
            <p-button *ngIf="item.activo" type="button" icon="pi pi-ban" severity="danger" [rounded]="true" [text]="true"
              pTooltip="Desactivar timbrado" [loading]="deactivatingId === item.id" (onClick)="deactivate(item)"></p-button>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .filters-bar {
      display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap;
      padding: 0.75rem 1rem; background: rgba(20,54,61,0.04);
      border: 1px solid rgba(20,54,61,0.1); border-radius: 14px; margin-bottom: 1.25rem;
    }
    .filters-icon { color: var(--brand-muted); font-size: 1rem; margin-bottom: 0.35rem; }
    .panel-box { border-radius: 16px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem; }
    .form-panel { border: 1.5px solid rgba(19,133,182,0.25); background: rgba(235,247,255,0.45); }
    .panel-box-title { font-weight: 700; font-size: 0.95rem; color: var(--brand-ink); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .panel-box-title .pi { color: var(--brand-blue); }
    .field-block { display: flex; flex-direction: column; gap: 0.3rem; }
    .field-block span { font-size: 0.8rem; font-weight: 600; color: var(--brand-muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .field-block em { color: #e53e3e; font-style: normal; }
    .field-block select, .field-block input {
      border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px;
      padding: 0.5rem 0.75rem; font-size: 0.92rem; color: var(--brand-ink);
      background: #fff; outline: none; transition: border-color 0.15s; width: 100%;
    }
    .field-block select:focus, .field-block input:focus { border-color: var(--brand-blue); }
    .series-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .wide2 { grid-column: span 2; }
    .form-footer { display: flex; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid rgba(20,54,61,0.1); }
    .series-grid { grid-template-columns: 1.6fr 0.9fr 1.1fr 0.9fr 1fr 1.4fr 0.8fr 0.5fr; }
    .actions-head { text-align: right; }
    .sub-text { display: block; font-size: 0.78rem; color: var(--brand-muted); }
    .warn-text { color: #b45309; }
    .ml-2 { margin-left: 0.4rem; }

    @media (max-width: 900px) {
      .filters-bar { flex-direction: column; align-items: stretch; }
      .series-form { grid-template-columns: 1fr; }
      .wide2 { grid-column: span 1; }
    }
  `]
})
export class InvoiceSeriesPageComponent implements OnInit {
  private readonly seriesApi = inject(InvoiceSeriesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get canManage(): boolean { return this.auth.hasRole('CompanyAdmin', 'BuildingManager'); }

  items: InvoiceSeries[] = [];
  private allItems: InvoiceSeries[] = [];
  buildings: Building[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  deactivatingId: string | null = null;
  filterBuildingId = '';
  filterDocumentType: InvoiceSeriesDocumentType | '' = '';
  form = this.createInitialForm();

  ngOnInit(): void {
    this.loadData();
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) this.form = this.createInitialForm();
  }

  applyFilters(): void {
    this.items = this.allItems.filter((x) =>
      (!this.filterBuildingId || x.buildingId === this.filterBuildingId) &&
      (!this.filterDocumentType || x.documentType === this.filterDocumentType));
    this.cdr.markForCheck();
  }

  submit(): void {
    if (this.form.rangoDesde >= this.form.rangoHasta) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El rango "desde" debe ser menor al rango "hasta".', life: 5000 });
      return;
    }
    if (this.form.vigenciaDesde > this.form.vigenciaHasta) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La vigencia "desde" debe ser anterior a "hasta".', life: 5000 });
      return;
    }

    this.isSaving = true;
    this.seriesApi.create({
      buildingId: this.form.buildingId,
      documentType: this.form.documentType,
      ruc: this.form.ruc.trim(),
      razonSocial: this.form.razonSocial.trim(),
      establecimiento: this.form.establecimiento.trim(),
      puntoExpedicion: this.form.puntoExpedicion.trim(),
      numeroTimbrado: this.form.numeroTimbrado.trim(),
      rangoDesde: Number(this.form.rangoDesde),
      rangoHasta: Number(this.form.rangoHasta),
      vigenciaDesde: this.form.vigenciaDesde,
      vigenciaHasta: this.form.vigenciaHasta
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (series) => {
        this.allItems = [series, ...this.allItems];
        this.applyFilters();
        this.form = this.createInitialForm();
        this.showForm = false;
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Timbrado creado.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo crear el timbrado.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  deactivate(item: InvoiceSeries): void {
    if (!confirm(`¿Desactivar el timbrado ${item.numeroTimbrado} de ${item.buildingName}? No podrá usarse para emitir nuevas facturas.`)) return;

    this.deactivatingId = item.id;
    this.seriesApi.deactivate(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.allItems = this.allItems.map((x) => x.id === item.id ? { ...x, activo: false } : x);
        this.applyFilters();
        this.deactivatingId = null;
        this.msg.add({ severity: 'warn', summary: 'Desactivado', detail: 'El timbrado fue desactivado.', life: 4000 });
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo desactivar el timbrado.'), life: 5000 });
        this.deactivatingId = null;
        this.cdr.markForCheck();
      }
    });
  }

  private loadData(): void {
    forkJoin({
      series: this.seriesApi.getAll(),
      buildings: this.buildingsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ series, buildings }) => {
        this.allItems = series;
        this.buildings = buildings;
        this.loading = false;
        this.applyFilters();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar los timbrados.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private createInitialForm() {
    return {
      buildingId: '',
      documentType: 'Invoice' as InvoiceSeriesDocumentType,
      ruc: '',
      razonSocial: '',
      establecimiento: '',
      puntoExpedicion: '',
      numeroTimbrado: '',
      rangoDesde: 1,
      rangoHasta: 9999999,
      vigenciaDesde: new Date().toISOString().slice(0, 10),
      vigenciaHasta: new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()).toISOString().slice(0, 10)
    };
  }
}
