import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { PlatformActivityApiService } from '../../api/platform-activity-api.service';
import { PlatformActivityItem } from '../../api/models';

// Auditoría de la plataforma (SuperAdmin): los movimientos recientes de empresas, administradores, condominios y edificios.
// Por ahora se arma con las fechas de alta y de modificación; todavía no registra qué usuario hizo cada cambio.
@Component({
  standalone: true,
  selector: 'app-audit-page',
  imports: [CommonModule, Card, Message],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Auditoría</h1>
            <p>Altas y cambios recientes de la plataforma (últimos 30 días).</p>
          </div>
        </div>
      </div>

      <p-message *ngIf="error" severity="error" [text]="error"></p-message>
      <p class="app-state" *ngIf="loading">Cargando movimientos...</p>
      <p class="app-state" *ngIf="!loading && !error && !items.length">No hubo movimientos en los últimos 30 días.</p>

      <div class="app-list" *ngIf="items.length">
        <div class="app-row header audit-grid">
          <span>Fecha y hora</span>
          <span>Acción</span>
          <span>Detalle</span>
        </div>
        <div class="app-row audit-grid" *ngFor="let item of items">
          <span class="audit-date">{{ item.atUtc | date:'dd/MM/yyyy HH:mm' }}</span>
          <strong>{{ item.title }}</strong>
          <span>{{ item.detail }}</span>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .audit-grid { grid-template-columns: 11rem 14rem 1fr; }
    .audit-date { color: var(--brand-muted); white-space: nowrap; }
    @media (max-width: 800px) { .audit-grid { grid-template-columns: 1fr; } }
  `]
})
export class AuditPageComponent implements OnInit {
  private readonly api = inject(PlatformActivityApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  items: PlatformActivityItem[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    this.api.get(30, 50).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: activity => {
        // El servidor manda las fechas en UTC; sin zona explícita el navegador las tomaría como hora local.
        this.items = activity.items.map(i => ({ ...i, atUtc: /Z|[+-]\d\d:?\d\d$/.test(i.atUtc) ? i.atUtc : i.atUtc + 'Z' }));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'No se pudieron cargar los movimientos.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
