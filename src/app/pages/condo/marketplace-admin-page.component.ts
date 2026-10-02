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
import { MarketplaceApiService } from '../../api/marketplace-api.service';
import { MarketplaceAdminBuilding } from '../../api/models';

type ModuleFilter = 'all' | 'available' | 'off' | 'noPlan';

// SuperAdmin: interruptor del «Marketplace» de espacios temporales por edificio, con su comisión de gestión y los datos
// para transferir. Solo se puede habilitar si el plan vigente del edificio lo incluye; apagarlo conserva la configuración
// y los datos.
@Component({
  standalone: true,
  selector: 'app-marketplace-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Marketplace por edificio</h1>
            <p>Habilitá el Marketplace de espacios en los edificios cuyo plan lo incluye, fijá la comisión de gestión y cargá los datos para transferir.</p>
          </div>
        </div>
      </div>

      <div class="filters">
        <input class="search" type="search" placeholder="Buscar edificio, empresa o plan" [ngModel]="search" (ngModelChange)="search = $event; cdr.markForCheck()" />
        <select [ngModel]="filter" (ngModelChange)="filter = $event; cdr.markForCheck()">
          <option value="all">Todos los edificios</option>
          <option value="available">Con el Marketplace habilitado</option>
          <option value="off">Con el Marketplace apagado</option>
          <option value="noPlan">Con plan sin Marketplace</option>
        </select>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando edificios...</p>
      <p class="app-state" *ngIf="!loading && !visible.length && !pageError">No hay edificios para mostrar.</p>

      <div class="app-list" *ngIf="visible.length">
        <div class="app-row header mk-grid">
          <span>Edificio</span>
          <span>Plan</span>
          <span>Marketplace</span>
          <span>Comisión</span>
          <span></span>
        </div>
        <div class="app-row mk-grid" *ngFor="let item of visible; trackBy: trackById">
          <div class="name-cell">
            <strong>{{ item.buildingName }}</strong>
            <small>{{ item.companyName }}<ng-container *ngIf="item.condominiumName"> · {{ item.condominiumName }}</ng-container></small>
          </div>
          <div class="name-cell">
            <span *ngIf="item.planName">{{ item.planName }}</span>
            <span *ngIf="!item.planName" class="muted">Sin plan</span>
            <p-tag *ngIf="item.planName" [value]="item.planIncludesMarketplace ? 'Incluye Marketplace' : 'Sin Marketplace'"
                   [severity]="item.planIncludesMarketplace ? 'success' : 'secondary'" styleClass="tag-sm"></p-tag>
          </div>
          <p-tag [value]="moduleLabel(item)" [severity]="moduleSeverity(item)"></p-tag>
          <span>{{ item.commissionPercent }} %</span>
          <div class="app-actions">
            <p-button type="button" label="Configurar" icon="pi pi-cog" size="small" severity="secondary" [outlined]="true"
                      (onClick)="openEdit(item)"></p-button>
          </div>
        </div>
      </div>
    </p-card>

    <div class="ov-backdrop" *ngIf="editTarget" (click)="closeEdit()"></div>
    <div class="ov-panel" *ngIf="editTarget" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Marketplace · {{ editTarget.buildingName }}</strong>
        <button class="ov-close" (click)="closeEdit()">✕</button>
      </div>

      <label class="checkbox">
        <input type="checkbox" [(ngModel)]="form.enabled" name="enabled" [disabled]="enableLocked" />
        <span>Marketplace habilitado en este edificio</span>
      </label>
      <p class="hint" *ngIf="enableLocked">El plan vigente del edificio no incluye el Marketplace. Asigná un plan que lo incluya para poder habilitarlo.</p>
      <p class="hint" *ngIf="!enableLocked && editTarget.moduleEnabled">Apagarlo no borra nada: al volver a habilitarlo sigue todo como estaba.</p>

      <label class="field">
        <span>Comisión de gestión (%)</span>
        <input type="number" [(ngModel)]="form.commissionPercent" name="commissionPercent" min="0" max="100" step="0.01" />
      </label>
      <p class="hint">Se suma al precio que pone el propietario y se muestra al comprador como «comisión por gestión». Cada reserva la congela al crearse.</p>

      <label class="field">
        <span>Datos para transferir</span>
        <textarea [(ngModel)]="form.transferInfo" name="transferInfo" rows="5" maxlength="1000"
                  placeholder="Banco, titular, número de cuenta, alias…"></textarea>
      </label>
      <p class="hint">Solo los ve quien está pagando una reserva, en la pantalla de pago.</p>

      <p class="form-error" *ngIf="formError">{{ formError }}</p>

      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" [disabled]="saving" (onClick)="closeEdit()"></p-button>
        <p-button label="Guardar" icon="pi pi-check" [loading]="saving" (onClick)="save()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .filters { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .filters input, .filters select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .filters .search { flex: 1 1 260px; min-width: 200px; }
    .mk-grid { grid-template-columns: 2fr 1.5fr 1.2fr 0.8fr 1.2fr; }
    .name-cell { display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start; }
    .name-cell small, .muted { color: var(--brand-muted); }
    :host ::ng-deep .tag-sm .p-tag { font-size: 0.7rem; padding: 0.1rem 0.4rem; }
    @media (max-width: 900px) { .mk-grid { grid-template-columns: 1fr; } .app-row.header { display: none; } .app-actions { justify-content: flex-start; } }

    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(15,35,50,0.45);
      z-index: 1000; backdrop-filter: blur(2px);
    }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(520px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28); padding: 1.6rem;
    }
    .ov-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(19,133,182,0.1);
    }
    .ov-header strong { font-size: 1.2rem; color: var(--brand-ink); }
    .ov-close {
      background: none; border: none; cursor: pointer; font-size: 1.1rem;
      color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%;
    }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .checkbox { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; color: var(--brand-ink); font-weight: 600; }
    .field { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 1rem; color: var(--brand-ink); font-weight: 600; }
    .field input, .field textarea {
      padding: 0.55rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-weight: 400; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .field textarea { resize: vertical; }
    .hint { margin: 0.35rem 0 0; font-size: 0.85rem; color: var(--brand-muted); line-height: 1.5; }
    .form-error { margin: 0.9rem 0 0; color: #b42318; font-size: 0.9rem; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.4rem; }
  `]
})
export class MarketplaceAdminPageComponent implements OnInit {
  private readonly api = inject(MarketplaceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly msg = inject(MessageService);
  readonly cdr = inject(ChangeDetectorRef);

  items: MarketplaceAdminBuilding[] = [];
  loading = true;
  pageError = '';
  search = '';
  filter: ModuleFilter = 'all';

  editTarget: MarketplaceAdminBuilding | null = null;
  form = { enabled: false, commissionPercent: 10, transferInfo: '' };
  formError = '';
  saving = false;

  ngOnInit(): void {
    this.api.getAdminBuildings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        this.items = items;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.pageError = extractApiErrorMessage(err, 'No se pudieron cargar los edificios.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  get visible(): MarketplaceAdminBuilding[] {
    const term = this.search.trim().toLowerCase();
    return this.items.filter(item => {
      if (term && !`${item.buildingName} ${item.companyName} ${item.condominiumName} ${item.planName}`.toLowerCase().includes(term)) {
        return false;
      }
      switch (this.filter) {
        case 'available': return item.moduleAvailable;
        case 'off': return !item.moduleEnabled;
        case 'noPlan': return !item.planIncludesMarketplace;
        default: return true;
      }
    });
  }

  trackById(_: number, item: MarketplaceAdminBuilding): string { return item.buildingId; }

  moduleLabel(item: MarketplaceAdminBuilding): string {
    if (item.moduleAvailable) return 'Habilitado';
    if (item.moduleEnabled) return 'Encendido, plan sin Marketplace';
    return 'Apagado';
  }

  moduleSeverity(item: MarketplaceAdminBuilding): 'success' | 'warn' | 'secondary' {
    if (item.moduleAvailable) return 'success';
    return item.moduleEnabled ? 'warn' : 'secondary';
  }

  // Encender exige un plan que incluya el Marketplace; si ya está encendido se puede apagar siempre.
  get enableLocked(): boolean {
    return !!this.editTarget && !this.editTarget.moduleEnabled && !this.editTarget.planIncludesMarketplace;
  }

  openEdit(item: MarketplaceAdminBuilding): void {
    this.editTarget = item;
    this.form = { enabled: item.moduleEnabled, commissionPercent: item.commissionPercent, transferInfo: item.transferInfo };
    this.formError = '';
  }

  closeEdit(): void {
    if (this.saving) return;
    this.editTarget = null;
  }

  save(): void {
    const target = this.editTarget;
    if (!target || this.saving) return;

    const commission = Number(this.form.commissionPercent);
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      this.formError = 'La comisión debe estar entre 0 y 100.';
      return;
    }
    if (Math.round(commission * 100) / 100 !== commission) {
      this.formError = 'La comisión admite como máximo 2 decimales.';
      return;
    }

    this.formError = '';
    this.saving = true;
    this.api.updateAdminBuilding(target.buildingId, {
      enabled: this.form.enabled,
      commissionPercent: commission,
      transferInfo: this.form.transferInfo.trim() || null
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.items = this.items.map(x => (x.buildingId === updated.buildingId ? updated : x));
        this.saving = false;
        this.editTarget = null;
        this.msg.add({ severity: 'success', summary: 'Guardado', detail: `Marketplace actualizado en ${updated.buildingName}.`, life: 5000 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.formError = extractApiErrorMessage(err, 'No se pudo guardar.');
        this.cdr.markForCheck();
      }
    });
  }
}
