import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { Building, Unit, UnitImportResult } from '../../api/models';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';

interface BuildingGroup {
  building: Building;
  units: Unit[];
  expanded: boolean;
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
        <div class="toolbar-actions">
          <p-button *ngIf="isSuperAdmin" label="Importar desde Excel" icon="pi pi-file-excel" severity="secondary" [outlined]="true" (onClick)="toggleImport()"></p-button>
          <p-button *ngIf="canCreateUnit" label="Nueva unidad" icon="pi pi-plus" (onClick)="goToCreate()"></p-button>
        </div>
      </div>

      <!-- Carga masiva desde Excel (solo SuperAdmin) -->
      <section class="import-panel" *ngIf="showImport && isSuperAdmin">
        <div class="import-head">
          <div>
            <h2>Importar unidades desde Excel</h2>
            <p>Descargá la plantilla, completá una fila por unidad (el edificio se elige de una lista) y subila para validar antes de guardar.</p>
          </div>
          <button type="button" class="import-close" (click)="closeImport()" aria-label="Cerrar"><i class="pi pi-times"></i></button>
        </div>

        <div class="import-actions">
          <p-button label="1. Descargar plantilla" icon="pi pi-download" severity="secondary" [outlined]="true" [loading]="downloading" (onClick)="downloadTemplate()"></p-button>
          <label class="file-btn" [class.disabled]="importing || confirming">
            <i class="pi pi-upload"></i> 2. Elegir archivo completado (.xlsx)
            <input type="file" accept=".xlsx" hidden [disabled]="importing || confirming" (change)="onImportFile($event)" />
          </label>
          <span class="file-name" *ngIf="importFile">{{ importFile.name }}</span>
        </div>

        <p-message *ngIf="importError" severity="error" [text]="importError"></p-message>
        <p class="app-state" *ngIf="importing">Validando archivo...</p>

        <ng-container *ngIf="importResult as r">
          <div class="import-summary">
            <span class="chip">{{ r.totalRows }} filas</span>
            <span class="chip ok">{{ r.validRows }} correctas</span>
            <span class="chip bad" *ngIf="r.errorRows">{{ r.errorRows }} con errores</span>
            <span class="chip done" *ngIf="r.created">{{ r.created }} unidades creadas</span>
          </div>

          <p-message *ngIf="r.message && !r.created" severity="warn" [text]="r.message"></p-message>
          <p-message *ngIf="r.created" severity="success" [text]="r.message || 'Unidades creadas.'"></p-message>

          <div class="import-buildings" *ngIf="r.buildings.length">
            <div class="ib-row" *ngFor="let b of r.buildings">
              <strong>{{ b.building }}</strong>
              <span>{{ b.newUnits }} nuevas · {{ b.existingUnits }} ya cargadas · coeficientes {{ b.coefficientTotal | number:'1.2-6' }}</span>
              <small class="ib-warn" *ngIf="b.warning"><i class="pi pi-exclamation-triangle"></i> {{ b.warning }}</small>
            </div>
          </div>

          <div class="import-table-wrap" *ngIf="r.rows.length">
            <table class="import-table">
              <thead><tr><th>Fila</th><th>Edificio</th><th>Código</th><th>Piso</th><th>Coef.</th><th>Activa</th><th>Resultado</th></tr></thead>
              <tbody>
                <tr *ngFor="let row of r.rows" [class.row-error]="row.error">
                  <td>{{ row.rowNumber }}</td>
                  <td>{{ row.building }}</td>
                  <td class="mono">{{ row.code }}</td>
                  <td>{{ row.floor }}</td>
                  <td class="mono">{{ row.coefficient | number:'1.2-6' }}</td>
                  <td>{{ row.isActive ? 'Sí' : 'No' }}</td>
                  <td>
                    <span *ngIf="!row.error" class="ok-text"><i class="pi pi-check"></i> Correcta</span>
                    <span *ngIf="row.error" class="err-text"><i class="pi pi-times-circle"></i> {{ row.error }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="import-confirm" *ngIf="!r.created">
            <p-button type="button" [label]="'3. Importar ' + r.validRows + ' unidades'" icon="pi pi-check" [loading]="confirming"
                      [disabled]="r.errorRows > 0 || r.validRows === 0" (onClick)="confirmImport()"></p-button>
            <small *ngIf="r.errorRows > 0">Corregí las filas con errores en el Excel y volvé a elegir el archivo: no se crea ninguna unidad hasta que todas estén correctas.</small>
          </div>
        </ng-container>
      </section>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando unidades...</p>
      <p class="app-state" *ngIf="!loading && !groups.length && !pageError">No hay unidades registradas.</p>

      <div class="groups" *ngIf="groups.length">
        <div class="building-group" *ngFor="let g of groups">
          <div class="building-header" (click)="g.expanded = !g.expanded">
            <i class="pi" [class.pi-chevron-down]="!g.expanded" [class.pi-chevron-up]="g.expanded"></i>
            <i class="pi pi-building"></i>
            <span class="building-name">{{ g.building.name }}</span>
            <span class="building-code">{{ g.building.code }}</span>
            <span class="unit-count">{{ g.units.length }} unidad{{ g.units.length !== 1 ? 'es' : '' }}</span>
          </div>

          <div class="app-list" *ngIf="g.expanded">
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
    .toolbar-actions { display:flex; gap:0.6rem; flex-wrap:wrap; }
    .import-panel { margin:1rem 0 1.5rem; padding:1.2rem 1.3rem; border:1px solid rgba(19,133,182,0.18); border-radius:18px; background:rgba(19,133,182,0.03); display:flex; flex-direction:column; gap:0.9rem; }
    .import-head { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; }
    .import-head h2 { margin:0 0 0.2rem; font-size:1.05rem; color:var(--brand-ink); }
    .import-head p { margin:0; font-size:0.86rem; color:var(--brand-muted); }
    .import-close { background:none; border:none; cursor:pointer; color:var(--brand-muted); font-size:1rem; }
    .import-actions { display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; }
    .file-btn { display:inline-flex; align-items:center; gap:0.45rem; padding:0.55rem 1rem; border-radius:999px; border:1px solid rgba(19,133,182,0.35); color:var(--brand-blue); font-weight:600; font-size:0.9rem; cursor:pointer; background:#fff; }
    .file-btn.disabled { opacity:0.6; cursor:progress; }
    .file-name { font-size:0.85rem; color:var(--brand-muted); }
    .import-summary { display:flex; gap:0.5rem; flex-wrap:wrap; }
    .chip { padding:0.25rem 0.75rem; border-radius:999px; font-size:0.8rem; font-weight:600; background:rgba(19,133,182,0.1); color:var(--brand-ink); }
    .chip.ok { background:rgba(106,198,74,0.18); color:#3d7d2d; }
    .chip.bad { background:rgba(201,77,63,0.14); color:#b64233; }
    .chip.done { background:var(--brand-gradient); color:#fff; }
    .import-buildings { display:flex; flex-direction:column; gap:0.45rem; }
    .ib-row { display:flex; flex-wrap:wrap; gap:0.2rem 0.9rem; align-items:baseline; font-size:0.86rem; }
    .ib-row span { color:var(--brand-muted); }
    .ib-warn { color:#b7791f; flex-basis:100%; }
    .import-table-wrap { max-height:22rem; overflow:auto; border:1px solid rgba(19,133,182,0.12); border-radius:12px; background:#fff; }
    .import-table { width:100%; border-collapse:collapse; font-size:0.84rem; }
    .import-table th { position:sticky; top:0; background:#eef6fa; text-align:left; padding:0.5rem 0.65rem; font-size:0.74rem; color:var(--brand-muted); }
    .import-table td { padding:0.4rem 0.65rem; border-top:1px solid rgba(19,133,182,0.08); }
    .import-table .mono { font-family:monospace; }
    .import-table tr.row-error { background:rgba(201,77,63,0.06); }
    .ok-text { color:#3d7d2d; font-weight:600; }
    .err-text { color:#b64233; font-weight:600; }
    .import-confirm { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
    .import-confirm small { color:var(--brand-muted); }
    .groups { display:flex; flex-direction:column; gap:2rem; }

    .building-group {}

    .building-header {
      display:flex; align-items:center; gap:0.6rem; margin-bottom:0.75rem;
      padding-bottom:0.5rem; border-bottom:2px solid rgba(19,133,182,0.12);
      cursor:pointer; user-select:none;
    }
    .building-header i { color:var(--brand-blue); font-size:1rem; }
    .building-header .pi-chevron-down, .building-header .pi-chevron-up { font-size:0.85rem; color:var(--brand-muted); }
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
  private readonly msg          = inject(MessageService);

  groups:    BuildingGroup[] = [];
  showImport = false;
  importFile: File | null = null;
  importResult: UnitImportResult | null = null;
  importError = '';
  importing = false;
  confirming = false;
  downloading = false;
  loading   = true;
  pageError = '';

  get isSuperAdmin(): boolean { return this.auth.hasRole('SuperAdmin'); }
  get canEdit(): boolean { return !this.auth.hasRole('CompanyAdmin'); }
  get canCreateUnit(): boolean {
    return this.canEdit && !this.auth.hasRole('BuildingManager') && !this.auth.hasRole('CompanyOperator');
  }

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
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
            units: us.sort((a, b) => a.code.localeCompare(b.code)),
            expanded: true
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

  // ─── Carga masiva desde Excel (SuperAdmin) ───────────────────────────────

  toggleImport(): void {
    this.showImport = !this.showImport;
    if (!this.showImport) this.resetImport();
  }

  closeImport(): void {
    this.showImport = false;
    this.resetImport();
  }

  private resetImport(): void {
    this.importFile = null;
    this.importResult = null;
    this.importError = '';
  }

  downloadTemplate(): void {
    this.downloading = true;
    this.unitsApi.downloadImportTemplate().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plantilla-unidades.xlsx';
        link.click();
        URL.revokeObjectURL(url);
        this.downloading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.downloading = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo descargar la plantilla.', life: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  // Al elegir el archivo se valida solo (sin guardar) y se muestra la vista previa fila por fila.
  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.importFile = file;
    this.importResult = null;
    this.importError = '';
    this.importing = true;

    this.unitsApi.importUnits(file, false).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.importResult = result; this.importing = false; this.cdr.markForCheck(); },
      error: (error) => {
        this.importError = extractApiErrorMessage(error, 'No se pudo validar el archivo.');
        this.importing = false;
        this.cdr.markForCheck();
      }
    });
  }

  confirmImport(): void {
    const file = this.importFile;
    if (!file || !this.importResult || this.importResult.errorRows > 0 || this.confirming) return;

    this.confirming = true;
    this.importError = '';
    this.unitsApi.importUnits(file, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.importResult = result;
        this.confirming = false;
        if (result.created > 0) {
          this.msg.add({ severity: 'success', summary: 'Importado', detail: result.message ?? `${result.created} unidades creadas.`, life: 5000 });
          this.load();
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.importError = extractApiErrorMessage(error, 'No se pudo importar el archivo.');
        this.confirming = false;
        this.cdr.markForCheck();
      }
    });
  }

  goToCreate(): void { this.router.navigate(['/units/create']); }
  goToEdit(id: string): void { this.router.navigate(['/units', id]); }
}
