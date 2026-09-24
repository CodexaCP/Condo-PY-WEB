import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Message } from 'primeng/message';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { Building, Unit } from '../../api/models';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';

interface BuildingGroup {
  building: Building;
  units: Unit[];
}

@Component({
  standalone: true,
  selector: 'app-units-page',
  imports: [CommonModule, Button, Card, Tag, Message],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Unidades</h1>
            <p>Unidades y locales de cada edificio, con piso y coeficiente para expensas.</p>
          </div>
        </div>
        <p-button *ngIf="canCreateUnit" label="Nueva unidad" icon="pi pi-plus" (onClick)="goToCreate()"></p-button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando unidades...</p>
      <p class="app-state" *ngIf="!loading && !groups.length && !pageError">No hay unidades registradas.</p>

      <div class="groups" *ngIf="groups.length">
        <div class="building-group" *ngFor="let g of groups">
          <div class="building-header">
            <i class="pi pi-building"></i>
            <span class="building-name">{{ g.building.name }}</span>
            <span class="building-code">{{ g.building.code }}</span>
            <span class="unit-count">{{ g.units.length }} unidad{{ g.units.length !== 1 ? 'es' : '' }}</span>
          </div>

          <div class="app-list">
            <div class="app-row header grid-unit">
              <span>Código</span>
              <span>Piso</span>
              <span>Coeficiente</span>
              <span>Estado</span>
            </div>
            <div class="app-row grid-unit" *ngFor="let u of g.units">
              <button class="row-link" (click)="goToEdit(u.id)" [disabled]="!canEdit">{{ u.code }}</button>
              <span class="floor-col">{{ u.floor }}</span>
              <span class="coef-col">{{ u.coefficient | number:'1.2-6' }}</span>
              <p-tag [value]="u.isActive ? 'Activo' : 'Inactivo'"
                     [severity]="u.isActive ? 'success' : 'secondary'"></p-tag>
            </div>
          </div>
        </div>
      </div>
    </p-card>
  `,
  styles: [`
    .groups { display:flex; flex-direction:column; gap:2rem; }

    .building-group {}

    .building-header {
      display:flex; align-items:center; gap:0.6rem; margin-bottom:0.75rem;
      padding-bottom:0.5rem; border-bottom:2px solid rgba(19,133,182,0.12);
    }
    .building-header i { color:var(--brand-blue); font-size:1rem; }
    .building-name { font-weight:700; font-size:0.97rem; color:var(--brand-ink); }
    .building-code {
      font-family:monospace; font-size:0.8rem; color:var(--brand-muted);
      background:rgba(19,133,182,0.08); padding:0.1rem 0.45rem; border-radius:6px;
    }
    .unit-count {
      margin-left:auto; font-size:0.78rem; color:var(--brand-muted);
      background:rgba(19,133,182,0.06); padding:0.15rem 0.6rem; border-radius:20px;
    }

    .grid-unit { grid-template-columns: 1fr 0.7fr 1fr 0.65fr; }
    .floor-col { color:var(--brand-muted); font-size:0.9rem; }
    .coef-col  { font-family:monospace; font-size:0.88rem; color:var(--brand-ink); }

    .row-link {
      background:none; border:none; padding:0; font:inherit; font-weight:700;
      color:var(--brand-blue); cursor:pointer; text-align:left;
      text-decoration:underline dotted;
    }
    .row-link:hover:not(:disabled) { color:var(--brand-ink); }
    .row-link:disabled { color:var(--brand-muted); cursor:default; text-decoration:none; }
  `]
})
export class UnitsPageComponent implements OnInit {
  private readonly unitsApi     = inject(UnitsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly auth         = inject(AuthService);
  private readonly router       = inject(Router);
  private readonly destroyRef   = inject(DestroyRef);
  private readonly cdr          = inject(ChangeDetectorRef);

  groups:    BuildingGroup[] = [];
  loading   = true;
  pageError = '';

  get canEdit(): boolean { return !this.auth.hasRole('CompanyAdmin'); }
  get canCreateUnit(): boolean { return this.canEdit && !this.auth.hasRole('BuildingManager'); }

  ngOnInit(): void {
    forkJoin({
      units:     this.unitsApi.getAll(),
      buildings: this.buildingsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ units, buildings }) => {
        const buildingMap = new Map(buildings.map(b => [b.id, b]));

        const grouped = new Map<string, Unit[]>();
        for (const u of units) {
          if (!grouped.has(u.buildingId)) grouped.set(u.buildingId, []);
          grouped.get(u.buildingId)!.push(u);
        }

        this.groups = [...grouped.entries()]
          .map(([bid, us]) => ({
            building: buildingMap.get(bid) ?? { id: bid, name: us[0].buildingName, code: '', companyId: '', condominiumId: null, condominiumName: '', address: '', isActive: true, blockOverdueAmenityReservations: false, invoicingMode: 'Preimpresa' as const },
            units: us.sort((a, b) => a.code.localeCompare(b.code))
          }))
          .sort((a, b) => a.building.name.localeCompare(b.building.name));

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.pageError = 'No se pudieron cargar las unidades.';
        this.loading   = false;
        this.cdr.markForCheck();
      }
    });
  }

  goToCreate(): void { this.router.navigate(['/units/create']); }
  goToEdit(id: string): void { this.router.navigate(['/units', id]); }
}
