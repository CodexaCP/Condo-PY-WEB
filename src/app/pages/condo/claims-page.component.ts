import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { ClaimsApiService } from '../../api/claims-api.service';
import { Building, Claim, ClaimStatus } from '../../api/models';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

const STATUS_OPTIONS: { label: string; value: ClaimStatus }[] = [
  { label: 'Pendiente', value: 'Pendiente' },
  { label: 'En proceso', value: 'EnProceso' },
  { label: 'Resuelto', value: 'Resuelto' }
];

const CATEGORY_SEVERITY: Record<string, TagSeverity> = {
  Ruido: 'warn',
  Limpieza: 'info',
  Mantenimiento: 'danger',
  Otro: 'secondary'
};

const STATUS_SEVERITY: Record<ClaimStatus, TagSeverity> = {
  Pendiente: 'warn',
  EnProceso: 'info',
  Resuelto: 'success'
};

@Component({
  standalone: true,
  selector: 'app-claims-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Select, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Reclamos</h1>
            <p>Seguimiento de consultas y reclamos enviados por residentes y propietarios.</p>
          </div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-item" *ngIf="buildings.length > 1">
          <label>Edificio</label>
          <p-select [options]="buildingOptions" [(ngModel)]="selectedBuildingId"
                    optionLabel="label" optionValue="value" placeholder="Todos"
                    [showClear]="true" (onChange)="reload()"></p-select>
        </div>

        <div class="filter-item">
          <label>Estado</label>
          <p-select [options]="statusFilterOptions" [(ngModel)]="selectedStatus"
                    optionLabel="label" optionValue="value" placeholder="Todos"
                    [showClear]="true" (onChange)="reload()"></p-select>
        </div>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando reclamos...</p>
      <p class="app-state" *ngIf="!loading && !pageError && !items.length">No hay reclamos para mostrar.</p>

      <div class="claims-list" *ngIf="items.length">
        <div class="claim-card" *ngFor="let item of items">
          <div class="claim-head">
            <div class="claim-meta">
              <div class="claim-title-row">
                <strong>Unidad {{ item.unitCode }}</strong>
                <p-tag [value]="item.category" [severity]="categorySeverity(item.category)"></p-tag>
              </div>
              <span>{{ item.buildingName }} · {{ item.createdByName }}</span>
              <small>{{ formatDate(item.createdAtUtc) }}</small>
            </div>

            <div class="claim-status-box">
              <p-tag [value]="statusLabel(item.status)" [severity]="statusSeverity(item.status)"></p-tag>
            </div>
          </div>

          <p class="claim-description">{{ item.description }}</p>

          <div class="claim-footer">
            <div class="claim-resolution" *ngIf="item.resolvedAtUtc">
              Resuelto {{ formatDate(item.resolvedAtUtc) }}
              <span *ngIf="item.resolvedByUserName">· {{ item.resolvedByUserName }}</span>
            </div>

            <div class="claim-actions">
              <p-select [options]="statusOptions"
                        [(ngModel)]="draftStatuses[item.id]"
                        optionLabel="label"
                        optionValue="value"></p-select>
              <p-button label="Actualizar"
                        icon="pi pi-check"
                        [loading]="updatingId === item.id"
                        [disabled]="draftStatuses[item.id] === item.status"
                        (onClick)="updateStatus(item)">
              </p-button>
            </div>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .filter-bar { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .filter-item { min-width: 220px; display: flex; flex-direction: column; gap: 0.4rem; }
    .filter-item label { font-size: 0.82rem; font-weight: 700; color: var(--brand-ink); }

    .claims-list { display: flex; flex-direction: column; gap: 1rem; }
    .claim-card {
      border: 1px solid rgba(19,133,182,0.12);
      border-radius: 18px;
      padding: 1rem 1.1rem;
      background: linear-gradient(180deg, rgba(248,250,252,0.92), #fff);
    }

    .claim-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .claim-meta { display: flex; flex-direction: column; gap: 0.18rem; }
    .claim-title-row { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; }
    .claim-meta strong { color: var(--brand-ink); font-size: 1rem; }
    .claim-meta span { color: var(--brand-blue); font-weight: 600; font-size: 0.86rem; }
    .claim-meta small { color: var(--brand-muted); font-size: 0.76rem; }

    .claim-description {
      margin: 0.9rem 0 0.95rem;
      color: var(--brand-ink);
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .claim-footer {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
      padding-top: 0.85rem;
      border-top: 1px solid rgba(19,133,182,0.08);
    }
    .claim-resolution { color: var(--brand-muted); font-size: 0.8rem; }
    .claim-actions { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
  `]
})
export class ClaimsPageComponent implements OnInit {
  private readonly claimsApi = inject(ClaimsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  items: Claim[] = [];
  buildings: Building[] = [];
  loading = true;
  pageError = '';
  updatingId: string | null = null;
  selectedBuildingId: string | null = null;
  selectedStatus: ClaimStatus | null = null;
  draftStatuses: Record<string, ClaimStatus> = {};
  readonly statusOptions = STATUS_OPTIONS;
  readonly statusFilterOptions = STATUS_OPTIONS.map(x => ({ ...x }));

  get buildingOptions() {
    return this.buildings.map(x => ({ label: x.name, value: x.id }));
  }

  ngOnInit(): void {
    forkJoin({
      buildings: this.buildingsApi.getAll(),
      items: this.claimsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ buildings, items }) => {
        this.buildings = buildings.filter(x => x.isActive).sort((a, b) => a.name.localeCompare(b.name));
        this.setItems(items);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.pageError = extractApiErrorMessage(err, 'No se pudo cargar los reclamos.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  reload(): void {
    this.loading = true;
    this.pageError = '';
    this.claimsApi.getAll(this.selectedBuildingId, this.selectedStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => {
          this.setItems(items);
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          this.pageError = extractApiErrorMessage(err, 'No se pudo actualizar los reclamos.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  updateStatus(item: Claim): void {
    const nextStatus = this.draftStatuses[item.id];
    if (!nextStatus || nextStatus === item.status) return;

    this.updatingId = item.id;
    this.claimsApi.updateStatus(item.id, { status: nextStatus })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          this.items = this.items.map(x => x.id === updated.id ? updated : x);
          this.draftStatuses[updated.id] = updated.status;
          this.updatingId = null;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Estado actualizado.', life: 3000 });
          this.cdr.markForCheck();
        },
        error: err => {
          this.updatingId = null;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo actualizar el estado.'), life: 5000 });
          this.cdr.markForCheck();
        }
      });
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  categorySeverity(category: string): TagSeverity {
    return CATEGORY_SEVERITY[category] ?? 'secondary';
  }

  statusSeverity(status: ClaimStatus): TagSeverity {
    return STATUS_SEVERITY[status];
  }

  statusLabel(status: ClaimStatus): string {
    return status === 'EnProceso' ? 'En proceso' : status;
  }

  private setItems(items: Claim[]): void {
    this.items = items;
    this.draftStatuses = Object.fromEntries(items.map(x => [x.id, x.status]));
  }
}
