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
import { AdCampaignsApiService } from '../../api/ad-campaigns-api.service';
import { AdBuilding } from '../../api/models';

type ModuleFilter = 'all' | 'on' | 'off';

// SuperAdmin: interruptor de la «Publicidad» por edificio, igual que Finanzas y el Marketplace. Viene apagada: un edificio
// solo muestra anuncios en la app (y solo puede recibir campañas) cuando se enciende acá. Apagarla conserva las campañas.
@Component({
  standalone: true,
  selector: 'app-ad-buildings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Publicidad por edificio</h1>
            <p>Activá la publicidad en los edificios que la contrataron. Un edificio apagado no muestra anuncios en la app ni puede recibir campañas.</p>
          </div>
        </div>
        <p-button label="Campañas" icon="pi pi-megaphone" size="small" severity="secondary" [outlined]="true" routerLink="/ad-campaigns"></p-button>
      </div>

      <div class="filters">
        <input class="search" type="search" placeholder="Buscar edificio, condominio o empresa" [ngModel]="search" (ngModelChange)="search = $event; cdr.markForCheck()" />
        <select [ngModel]="filter" (ngModelChange)="filter = $event; cdr.markForCheck()">
          <option value="all">Todos los edificios</option>
          <option value="on">Con publicidad activada</option>
          <option value="off">Con publicidad apagada</option>
        </select>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando edificios...</p>
      <p class="app-state" *ngIf="!loading && !visible.length && !pageError">No hay edificios para mostrar.</p>

      <div class="app-list" *ngIf="visible.length">
        <div class="app-row header ad-grid">
          <span>Edificio</span>
          <span>Publicidad</span>
          <span>Campañas activas</span>
          <span></span>
        </div>
        <div class="app-row ad-grid" *ngFor="let item of visible; trackBy: trackById">
          <div class="name-cell">
            <strong>{{ item.buildingName }}</strong>
            <small>{{ item.companyName }}<ng-container *ngIf="item.condominiumName"> · {{ item.condominiumName }}</ng-container></small>
          </div>
          <p-tag [value]="item.adsEnabled ? 'Activada' : 'Apagada'" [severity]="item.adsEnabled ? 'success' : 'secondary'"></p-tag>
          <span>{{ item.campaignCount }}</span>
          <div class="app-actions">
            <p-button type="button" size="small" [outlined]="true"
                      [label]="item.adsEnabled ? 'Apagar' : 'Activar'"
                      [icon]="item.adsEnabled ? 'pi pi-power-off' : 'pi pi-check'"
                      [severity]="item.adsEnabled ? 'secondary' : 'primary'"
                      [loading]="savingId === item.buildingId" [disabled]="!!savingId"
                      (onClick)="toggle(item)"></p-button>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .filters { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .filters input, .filters select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .filters .search { flex: 1 1 260px; min-width: 200px; }
    .ad-grid { grid-template-columns: 2.5fr 1.2fr 1.2fr 1.2fr; }
    .name-cell { display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start; }
    .name-cell small { color: var(--brand-muted); }
    @media (max-width: 900px) { .ad-grid { grid-template-columns: 1fr; } .app-row.header { display: none; } .app-actions { justify-content: flex-start; } }
  `]
})
export class AdBuildingsPageComponent implements OnInit {
  private readonly api = inject(AdCampaignsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly msg = inject(MessageService);
  readonly cdr = inject(ChangeDetectorRef);

  items: AdBuilding[] = [];
  loading = true;
  pageError = '';
  search = '';
  filter: ModuleFilter = 'all';
  savingId = '';

  ngOnInit(): void {
    this.api.getBuildings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

  get visible(): AdBuilding[] {
    const term = this.search.trim().toLowerCase();
    return this.items.filter(item => {
      if (term && !`${item.buildingName} ${item.companyName} ${item.condominiumName}`.toLowerCase().includes(term)) return false;
      if (this.filter === 'on') return item.adsEnabled;
      if (this.filter === 'off') return !item.adsEnabled;
      return true;
    });
  }

  trackById(_: number, item: AdBuilding): string { return item.buildingId; }

  toggle(item: AdBuilding): void {
    if (this.savingId) return;
    this.savingId = item.buildingId;
    this.api.setBuildingEnabled(item.buildingId, !item.adsEnabled).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.items = this.items.map(x => (x.buildingId === updated.buildingId ? updated : x));
        this.savingId = '';
        this.msg.add({
          severity: 'success', summary: 'Guardado', life: 5000,
          detail: `Publicidad ${updated.adsEnabled ? 'activada' : 'apagada'} en ${updated.buildingName}.`
        });
        this.cdr.markForCheck();
      },
      error: err => {
        this.savingId = '';
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar.'), life: 6000 });
        this.cdr.markForCheck();
      }
    });
  }
}
