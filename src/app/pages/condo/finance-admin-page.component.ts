import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinanceAdminBuilding } from '../../api/models';

type ModuleFilter = 'all' | 'available' | 'off' | 'noPlan';

// SuperAdmin: interruptor del módulo «Finanzas del edificio» por edificio. Solo se puede habilitar si el plan vigente del
// edificio incluye el módulo; apagarlo conserva la configuración y los datos.
@Component({
  standalone: true,
  selector: 'app-finance-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Finanzas por edificio</h1>
            <p>Habilitá el módulo «Finanzas del edificio» en los edificios cuyo plan lo incluye. Lo ven y lo configuran los usuarios del edificio.</p>
          </div>
        </div>
      </div>

      <div class="filters">
        <input class="search" type="search" placeholder="Buscar edificio, empresa o plan" [ngModel]="search" (ngModelChange)="search = $event; cdr.markForCheck()" />
        <select [ngModel]="filter" (ngModelChange)="filter = $event; cdr.markForCheck()">
          <option value="all">Todos los edificios</option>
          <option value="available">Con el módulo habilitado</option>
          <option value="off">Con el módulo apagado</option>
          <option value="noPlan">Con plan sin Finanzas</option>
        </select>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando edificios...</p>
      <p class="app-state" *ngIf="!loading && !visible.length && !pageError">No hay edificios para mostrar.</p>

      <div class="app-list" *ngIf="visible.length">
        <div class="app-row header fin-grid">
          <span>Edificio</span>
          <span>Plan</span>
          <span>Módulo</span>
          <span>Configuración</span>
          <span></span>
        </div>
        <div class="app-row fin-grid" *ngFor="let item of visible; trackBy: trackById">
          <div class="name-cell">
            <strong>{{ item.buildingName }}</strong>
            <small>{{ item.companyName }}<ng-container *ngIf="item.condominiumName"> · {{ item.condominiumName }}</ng-container></small>
          </div>
          <div class="name-cell">
            <span *ngIf="item.planName">{{ item.planName }}</span>
            <span *ngIf="!item.planName" class="muted">Sin plan</span>
            <p-tag *ngIf="item.planName" [value]="item.planIncludesFinanceModule ? 'Incluye Finanzas' : 'Sin Finanzas'"
                   [severity]="item.planIncludesFinanceModule ? 'success' : 'secondary'" styleClass="tag-sm"></p-tag>
          </div>
          <p-tag [value]="moduleLabel(item)" [severity]="moduleSeverity(item)"></p-tag>
          <span>
            <p-tag *ngIf="item.moduleEnabled" [value]="item.setupCompleted ? 'Completa' : 'Pendiente'"
                   [severity]="item.setupCompleted ? 'success' : 'warn'"></p-tag>
            <span *ngIf="!item.moduleEnabled" class="muted">—</span>
          </span>
          <div class="app-actions">
            <a *ngIf="item.moduleAvailable" [routerLink]="['/finance/settings']" [queryParams]="{ buildingId: item.buildingId }" style="display:contents">
              <p-button type="button" label="Configurar" icon="pi pi-cog" size="small" severity="secondary" [outlined]="true"></p-button>
            </a>
            <p-button *ngIf="!item.moduleEnabled" type="button" label="Habilitar" icon="pi pi-check" size="small"
                      [disabled]="!item.planIncludesFinanceModule || busyId === item.buildingId" [loading]="busyId === item.buildingId"
                      (onClick)="enable(item)"></p-button>
            <p-button *ngIf="item.moduleEnabled" type="button" label="Apagar" icon="pi pi-power-off" size="small" severity="danger" [outlined]="true"
                      [disabled]="busyId === item.buildingId" (onClick)="askDisable(item)"></p-button>
          </div>
        </div>
      </div>
    </p-card>

    <div class="ov-backdrop" *ngIf="confirmTarget" (click)="cancelDisable()"></div>
    <div class="ov-panel" *ngIf="confirmTarget" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Apagar Finanzas del edificio</strong>
        <button class="ov-close" (click)="cancelDisable()">✕</button>
      </div>
      <p class="confirm-text">
        ¿Apagar el módulo en <strong>{{ confirmTarget.buildingName }}</strong>? Sus usuarios dejarán de ver Finanzas y la API responderá que no está habilitado.
        La configuración y los datos cargados se conservan: al volver a habilitarlo sigue todo como estaba.
      </p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDisable()"></p-button>
        <p-button label="Apagar módulo" severity="danger" [loading]="busyId === confirmTarget.buildingId" (onClick)="confirmDisable()"></p-button>
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
    .fin-grid { grid-template-columns: 2fr 1.5fr 1.2fr 1fr 2fr; }
    .name-cell { display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start; }
    .name-cell small, .muted { color: var(--brand-muted); }
    :host ::ng-deep .tag-sm .p-tag { font-size: 0.7rem; padding: 0.1rem 0.4rem; }
    @media (max-width: 900px) { .fin-grid { grid-template-columns: 1fr; } .app-row.header { display: none; } .app-actions { justify-content: flex-start; } }

    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(15,35,50,0.45);
      z-index: 1000; backdrop-filter: blur(2px);
    }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(460px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
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
    .confirm-text { margin: 0 0 1.2rem; color: var(--brand-ink); line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `]
})
export class FinanceAdminPageComponent implements OnInit {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly msg = inject(MessageService);
  readonly cdr = inject(ChangeDetectorRef);

  items: FinanceAdminBuilding[] = [];
  loading = true;
  pageError = '';
  search = '';
  filter: ModuleFilter = 'all';
  busyId: string | null = null;
  confirmTarget: FinanceAdminBuilding | null = null;

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

  get visible(): FinanceAdminBuilding[] {
    const term = this.search.trim().toLowerCase();
    return this.items.filter(item => {
      if (term && !`${item.buildingName} ${item.companyName} ${item.condominiumName} ${item.planName}`.toLowerCase().includes(term)) {
        return false;
      }
      switch (this.filter) {
        case 'available': return item.moduleAvailable;
        case 'off': return !item.moduleEnabled;
        case 'noPlan': return !item.planIncludesFinanceModule;
        default: return true;
      }
    });
  }

  trackById(_: number, item: FinanceAdminBuilding): string { return item.buildingId; }

  moduleLabel(item: FinanceAdminBuilding): string {
    if (item.moduleAvailable) return 'Habilitado';
    if (item.moduleEnabled) return 'Encendido, plan sin Finanzas';
    return 'Apagado';
  }

  moduleSeverity(item: FinanceAdminBuilding): 'success' | 'warn' | 'secondary' {
    if (item.moduleAvailable) return 'success';
    return item.moduleEnabled ? 'warn' : 'secondary';
  }

  enable(item: FinanceAdminBuilding): void {
    if (this.busyId) return;
    this.busyId = item.buildingId;
    this.api.enable(item.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.replace(updated);
        this.busyId = null;
        this.msg.add({ severity: 'success', summary: 'Módulo habilitado', detail: `Finanzas del edificio quedó habilitado en ${updated.buildingName}. Falta completar su configuración.`, life: 6000 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.busyId = null;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo habilitar el módulo.'), life: 6000 });
        this.cdr.markForCheck();
      }
    });
  }

  askDisable(item: FinanceAdminBuilding): void { this.confirmTarget = item; }
  cancelDisable(): void { if (!this.busyId) this.confirmTarget = null; }

  confirmDisable(): void {
    const target = this.confirmTarget;
    if (!target || this.busyId) return;
    this.busyId = target.buildingId;
    this.api.disable(target.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.replace(updated);
        this.busyId = null;
        this.confirmTarget = null;
        this.msg.add({ severity: 'success', summary: 'Módulo apagado', detail: `Finanzas del edificio quedó apagado en ${updated.buildingName}.`, life: 5000 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.busyId = null;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo apagar el módulo.'), life: 6000 });
        this.cdr.markForCheck();
      }
    });
  }

  private replace(updated: FinanceAdminBuilding): void {
    this.items = this.items.map(x => (x.buildingId === updated.buildingId ? updated : x));
  }
}
