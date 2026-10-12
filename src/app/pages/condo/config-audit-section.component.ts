import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { BuildingConfigApiService } from '../../api/building-config-api.service';
import { ConfigAuditEntry, ConfigAuditPage, ConfigSection } from '../../api/building-config.models';
import { extractApiErrorMessage } from '../../api/api-error.util';

const ROLE_LABELS: Record<string, string> = {
  SuperAdmin: 'SuperAdmin',
  CompanyAdmin: 'Administrador',
  CompanyOperator: 'Operador',
  BuildingManager: 'Encargado'
};

const ACTION_LABELS: Record<string, string> = {
  Updated: 'Cambió',
  Created: 'Creó',
  Deleted: 'Eliminó',
  Closed: 'Cerró',
  Reopened: 'Reabrió',
  Enabled: 'Activó',
  Disabled: 'Desactivó',
  Started: 'Inició',
  Completed: 'Cerró',
  Marked: 'Marcó',
  Unmarked: 'Desmarcó',
  Discarded: 'Descartó'
};

// Historial de cambios de la configuración del edificio: quién cambió qué, cuándo y con qué valores antes y después. Solo lo ven el
// SuperAdmin y el Administrador de empresa (contiene correos y nombres de quienes configuran).
@Component({
  standalone: true,
  selector: 'app-config-audit-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Message],
  template: `
    <h2>Historial de cambios</h2>
    <p class="muted small">Cada cambio de la configuración queda registrado con quién lo hizo y qué valores tenía antes.</p>

    <div class="filters">
      <label><span>Sección</span>
        <select [(ngModel)]="section" (ngModelChange)="reload()">
          <option value="">Todas</option>
          <option *ngFor="let s of sections" [value]="s.key">{{ s.name }}</option>
        </select>
      </label>
      <label><span>Desde</span><input type="date" [(ngModel)]="from" (ngModelChange)="reload()" /></label>
      <label><span>Hasta</span><input type="date" [(ngModel)]="to" (ngModelChange)="reload()" /></label>
    </div>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading">Cargando...</p>
    <p class="muted" *ngIf="!loading && !error && data && !data.items.length">No hay cambios registrados con esos filtros.</p>

    <ul class="entries" *ngIf="data?.items?.length">
      <li *ngFor="let e of data!.items" class="entry">
        <div class="head">
          <div>
            <strong>{{ e.summary }}</strong>
            <div class="meta">
              {{ e.createdAtUtc | date: 'dd/MM/yyyy HH:mm' }} · {{ e.userName || e.userEmail }}
              <span class="role">{{ roleLabel(e.userRole) }}</span> · {{ e.sectionName }} · {{ actionLabel(e.action) }}
            </div>
          </div>
          <button type="button" class="link-btn" *ngIf="e.changes.length" (click)="toggle(e)">
            {{ isOpen(e) ? 'Ocultar detalle' : 'Ver detalle (' + e.changes.length + ')' }}
          </button>
        </div>
        <table class="changes" *ngIf="isOpen(e)">
          <thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead>
          <tbody>
            <tr *ngFor="let c of e.changes">
              <td>{{ c.label }}</td>
              <td class="before">{{ c.before ?? '—' }}</td>
              <td class="after">{{ c.after ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </li>
    </ul>

    <div class="pager" *ngIf="data && data.totalCount > data.pageSize">
      <p-button type="button" label="Anterior" icon="pi pi-chevron-left" severity="secondary" [outlined]="true" [disabled]="page <= 1" (onClick)="go(page - 1)"></p-button>
      <span class="muted">Página {{ page }} de {{ pages }} · {{ data.totalCount }} cambios</span>
      <p-button type="button" label="Siguiente" icon="pi pi-chevron-right" iconPos="right" severity="secondary" [outlined]="true" [disabled]="page >= pages" (onClick)="go(page + 1)"></p-button>
    </div>
  `,
  styles: [`
    h2 { margin: 0 0 0.3rem; font-size: 1.2rem; color: var(--brand-ink); }
    .muted { color: var(--brand-muted); }
    .small { font-size: 0.85rem; margin: 0 0 0.8rem; }
    .filters { display: flex; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .filters label { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .filters select, .filters input {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.92rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .entries { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
    .entry { border: 1px solid var(--brand-border); border-radius: 12px; padding: 0.8rem 1rem; }
    .head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
    .meta { font-size: 0.82rem; color: var(--brand-muted); margin-top: 0.2rem; }
    .role { background: var(--brand-gradient-soft); border-radius: 999px; padding: 0.05rem 0.5rem; font-weight: 600; color: var(--brand-ink); }
    .link-btn { background: none; border: none; color: #1385B6; font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .changes { width: 100%; border-collapse: collapse; margin-top: 0.7rem; font-size: 0.88rem; }
    .changes th { text-align: left; padding: 0.35rem 0.5rem; color: var(--brand-muted); border-bottom: 1px solid var(--brand-border); }
    .changes td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--brand-border); vertical-align: top; }
    .before { color: #c9473b; }
    .after { color: #2f8f46; font-weight: 600; }
    .pager { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1rem; }
  `]
})
export class ConfigAuditSectionComponent implements OnChanges {
  private readonly api = inject(BuildingConfigApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';
  // Secciones del Centro, para el filtro.
  @Input() sections: ConfigSection[] = [];

  readonly pageSize = 20;
  section = '';
  from = '';
  to = '';
  page = 1;
  data: ConfigAuditPage | null = null;
  loading = false;
  error = '';
  private readonly open = new Set<string>();

  get pages(): number { return this.data ? Math.max(Math.ceil(this.data.totalCount / this.data.pageSize), 1) : 1; }

  roleLabel(role: string): string { return ROLE_LABELS[role] ?? role; }
  actionLabel(action: string): string { return ACTION_LABELS[action] ?? action; }
  isOpen(e: ConfigAuditEntry): boolean { return this.open.has(e.id); }

  toggle(e: ConfigAuditEntry): void {
    if (this.open.has(e.id)) this.open.delete(e.id); else this.open.add(e.id);
    this.cdr.markForCheck();
  }

  ngOnChanges(): void {
    this.page = 1;
    this.load();
  }

  reload(): void {
    this.page = 1;
    this.load();
  }

  go(page: number): void {
    this.page = page;
    this.load();
  }

  private load(): void {
    if (!this.buildingId) return;

    this.loading = true;
    this.error = '';
    this.api.getAudit(this.buildingId, {
      section: this.section || undefined,
      from: this.from ? `${this.from}T00:00:00` : undefined,
      to: this.to ? `${this.to}T23:59:59` : undefined,
      page: this.page,
      pageSize: this.pageSize
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.data = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo cargar el historial de cambios.');
        this.cdr.markForCheck();
      }
    });
  }
}
