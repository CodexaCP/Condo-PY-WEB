import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { NotificationsApiService } from '../../api/notifications-api.service';
import { AppNotification } from '../../api/models';

const TYPE_ICON: Record<string, string> = {
  OwnerPaymentSubmitted: 'pi-inbox',
  PaymentUnderReview:    'pi-search',
  PaymentApproved:       'pi-check-circle',
  PaymentRejected:       'pi-times-circle'
};

const TYPE_COLOR: Record<string, string> = {
  OwnerPaymentSubmitted: '#f59e0b',
  PaymentUnderReview:    '#3b82f6',
  PaymentApproved:       '#22c55e',
  PaymentRejected:       '#ef4444'
};

@Component({
  standalone: true,
  selector: 'app-notificaciones-page',
  imports: [CommonModule, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Notificaciones</h1>
            <p>{{ unreadCount }} sin leer</p>
          </div>
        </div>
        <p-button
          *ngIf="unreadCount > 0"
          label="Marcar todas leídas"
          icon="pi pi-check-square"
          severity="secondary"
          [outlined]="true"
          (onClick)="markAllAsRead()"
          [loading]="markingAll">
        </p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando notificaciones...</p>
      <p class="app-state" *ngIf="!loading && !items.length && !pageError">
        No tienes notificaciones.
      </p>

      <div class="notif-list" *ngIf="items.length">
        <div
          class="notif-item"
          [class.unread]="!n.isRead"
          *ngFor="let n of items"
          (click)="handleClick(n)"
          [style.cursor]="n.entityId ? 'pointer' : 'default'">

          <div class="notif-icon" [style.background]="typeColor(n.type)">
            <i class="pi" [class]="typeIcon(n.type)"></i>
          </div>

          <div class="notif-body">
            <p class="notif-title">{{ n.title }}</p>
            <p class="notif-text">{{ n.body }}</p>
          </div>

          <div class="notif-meta">
            <span class="notif-date">{{ n.createdAtUtc | date:'dd/MM/yyyy HH:mm' }}</span>
            <p-tag *ngIf="!n.isRead" value="Nuevo" severity="warn" styleClass="unread-tag"></p-tag>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .notif-list   { display: flex; flex-direction: column; gap: 0; }

    .notif-item   {
      display: flex; align-items: flex-start; gap: 1rem;
      padding: 1rem 0.5rem; border-bottom: 1px solid var(--p-surface-200);
      transition: background 0.12s;
    }
    .notif-item:last-child { border-bottom: none; }
    .notif-item:hover      { background: var(--p-surface-50); }
    .notif-item.unread     { background: color-mix(in srgb, var(--p-primary-color) 4%, transparent); }
    .notif-item.unread .notif-title { font-weight: 700; }

    .notif-icon   {
      flex-shrink: 0; width: 2.4rem; height: 2.4rem; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .notif-icon .pi { color: #fff; font-size: 1rem; }

    .notif-body   { flex: 1; min-width: 0; }
    .notif-title  { margin: 0 0 0.2rem; font-size: 0.9rem; font-weight: 500; }
    .notif-text   { margin: 0; font-size: 0.82rem; color: var(--brand-muted); line-height: 1.4; }

    .notif-meta   {
      flex-shrink: 0; display: flex; flex-direction: column;
      align-items: flex-end; gap: 0.4rem; min-width: 7rem;
    }
    .notif-date   { font-size: 0.78rem; color: var(--brand-muted); white-space: nowrap; }
    .unread-tag   { font-size: 0.7rem; }
  `]
})
export class NotificacionesPageComponent implements OnInit {
  private readonly api        = inject(NotificationsApiService);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr        = inject(ChangeDetectorRef);

  items:      AppNotification[] = [];
  loading     = true;
  markingAll  = false;
  pageError   = '';

  get unreadCount(): number { return this.items.filter(n => !n.isRead).length; }

  ngOnInit(): void {
    this.api.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => {
          this.items   = items;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.pageError = 'No se pudieron cargar las notificaciones.';
          this.loading   = false;
          this.cdr.markForCheck();
        }
      });
  }

  handleClick(n: AppNotification): void {
    if (!n.isRead) {
      n.isRead = true;
      this.api.markRead(n.id).subscribe();
      this.cdr.markForCheck();
    }
    if (n.entityType === 'OwnerPayment' && n.entityId) {
      void this.router.navigate(['/owner-payments', n.entityId]);
    }
  }

  markAllAsRead(): void {
    this.markingAll = true;
    this.api.markAllRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.forEach(n => n.isRead = true);
          this.markingAll = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.markingAll = false;
          this.cdr.markForCheck();
        }
      });
  }

  typeIcon(type: string): string  { return TYPE_ICON[type]  ?? 'pi-bell'; }
  typeColor(type: string): string { return TYPE_COLOR[type] ?? '#64748b'; }
}
