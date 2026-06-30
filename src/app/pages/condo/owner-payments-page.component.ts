import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { OwnerPaymentsApiService } from '../../api/owner-payments-api.service';
import { OwnerPayment } from '../../api/models';

const STATUS_LABELS: Record<string, string> = {
  Pending:     'Pendiente',
  UnderReview: 'En Revisión',
  Approved:    'Aprobado',
  Rejected:    'Rechazado'
};

const STATUS_SEVERITY: Record<string, 'warn' | 'info' | 'success' | 'danger' | 'secondary'> = {
  Pending:     'warn',
  UnderReview: 'info',
  Approved:    'success',
  Rejected:    'danger'
};

const FILTERS: { label: string; value: string }[] = [
  { label: 'Todos',        value: '' },
  { label: 'Pendiente',    value: 'Pending' },
  { label: 'En Revisión',  value: 'UnderReview' },
  { label: 'Aprobado',     value: 'Approved' },
  { label: 'Rechazado',    value: 'Rejected' }
];

@Component({
  standalone: true,
  selector: 'app-owner-payments-page',
  imports: [CommonModule, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Pagos de Propietarios</h1>
            <p>Revisión y aprobación de pagos enviados por propietarios.</p>
          </div>
        </div>
      </div>

      <div class="status-tabs">
        <button
          *ngFor="let f of filters"
          class="status-tab"
          [class.active]="selectedStatus === f.value"
          (click)="selectFilter(f.value)">
          {{ f.label }}
          <span *ngIf="countFor(f.value) > 0" class="tab-count">{{ countFor(f.value) }}</span>
        </button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando pagos...</p>
      <p class="app-state" *ngIf="!loading && !filtered.length && !pageError">
        No hay pagos {{ selectedStatus ? 'con este estado' : 'registrados' }}.
      </p>

      <div class="app-list" *ngIf="filtered.length">
        <div class="app-row header grid-op">
          <span>Referencia</span>
          <span>Propietario</span>
          <span>Fecha Pago</span>
          <span class="right">Monto Declarado</span>
          <span>Estado</span>
          <span>Enviado</span>
        </div>
        <div class="app-row grid-op" *ngFor="let item of filtered">
          <button class="row-link monospace" (click)="goToDetail(item.id)">
            {{ item.reference }}
          </button>
          <span>{{ item.ownerFullName }}</span>
          <span>{{ item.paymentDate | date:'dd/MM/yyyy' }}</span>
          <span class="right amount-col">{{ item.declaredAmount | number:'1.0-2' }}</span>
          <p-tag
            [value]="statusLabel(item.status)"
            [severity]="statusSeverity(item.status)">
          </p-tag>
          <span class="date-col">{{ item.createdAtUtc | date:'dd/MM/yyyy HH:mm' }}</span>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .status-tabs   { display: flex; gap: 0.5rem; margin-bottom: 1.2rem; flex-wrap: wrap; }
    .status-tab    {
      padding: 0.3rem 0.9rem; border-radius: 20px; border: 1.5px solid var(--p-primary-color);
      background: transparent; cursor: pointer; font-size: 0.82rem; font-weight: 600;
      color: var(--p-primary-color); transition: all 0.15s; display: flex; align-items: center; gap: 0.35rem;
    }
    .status-tab.active { background: var(--p-primary-color); color: #fff; }
    .status-tab:hover:not(.active) { background: color-mix(in srgb, var(--p-primary-color) 10%, transparent); }
    .tab-count     {
      background: rgba(0,0,0,0.12); border-radius: 10px;
      padding: 0 0.4rem; font-size: 0.75rem; min-width: 1.2rem; text-align: center;
    }
    .active .tab-count { background: rgba(255,255,255,0.25); }
    .grid-op       { grid-template-columns: 1.3fr 1.4fr 0.9fr 1fr 0.9fr 1.1fr; }
    .monospace     { font-family: monospace; font-size: 0.88rem; }
    .right         { text-align: right; }
    .amount-col    { font-weight: 600; font-family: monospace; }
    .date-col      { font-size: 0.85rem; color: var(--brand-muted); }
    .row-link      {
      background: none; border: none; padding: 0; font: inherit; font-weight: 700;
      color: var(--brand-blue); cursor: pointer; text-align: left; text-decoration: underline dotted;
    }
    .row-link:hover { color: var(--brand-ink); }
  `]
})
export class OwnerPaymentsPageComponent implements OnInit {
  private readonly api        = inject(OwnerPaymentsApiService);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr        = inject(ChangeDetectorRef);

  readonly filters = FILTERS;

  all:            OwnerPayment[] = [];
  filtered:       OwnerPayment[] = [];
  selectedStatus  = '';
  loading         = true;
  pageError       = '';

  ngOnInit(): void {
    this.api.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => {
          this.all      = items;
          this.applyFilter();
          this.loading  = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.pageError = 'No se pudieron cargar los pagos.';
          this.loading   = false;
          this.cdr.markForCheck();
        }
      });
  }

  selectFilter(value: string): void {
    this.selectedStatus = value;
    this.applyFilter();
  }

  countFor(status: string): number {
    if (!status) return 0;
    return this.all.filter(p => p.status === status).length;
  }

  goToDetail(id: string): void {
    this.router.navigate(['/owner-payments', id]);
  }

  statusLabel(status: string): string     { return STATUS_LABELS[status] ?? status; }
  statusSeverity(status: string): 'warn' | 'info' | 'success' | 'danger' | 'secondary' {
    return STATUS_SEVERITY[status] ?? 'secondary';
  }

  private applyFilter(): void {
    this.filtered = this.selectedStatus
      ? this.all.filter(p => p.status === this.selectedStatus)
      : this.all;
  }
}
