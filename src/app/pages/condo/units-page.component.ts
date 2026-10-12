import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, debounceTime, of, Subject, switchMap, tap } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { Building, Unit, UnitImportResult, UnitPage, UnitStatusFilter } from '../../api/models';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';
import { LIST_FILTERS_STYLES } from './list-filters.styles';
import { ListPagerComponent } from './list-pager.component';
import { loadListState, saveListState } from './list-state.util';

const STATE_KEY = 'units';

interface UnitFilters {
  search: string;
  buildingId: string;
  floor: string;
  status: UnitStatusFilter;
  pageSize: number;
}

@Component({
  standalone: true,
  selector: 'app-units-page',
  imports: [CommonModule, FormsModule, Button, Card, Tag, Message, ListPagerComponent],
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

      <!-- Búsqueda y filtros -->
      <div class="filters-bar">
        <div class="field-block search-field">
          <span>Buscar</span>
          <div class="search-box">
            <span class="pi pi-search"></span>
            <input type="text" [ngModel]="filters.search" (ngModelChange)="onSearchInput($event)" name="search"
                   placeholder="Código, piso o edificio" autocomplete="off" />
            <button type="button" class="search-clear" *ngIf="filters.search" (click)="clearSearch()" aria-label="Borrar búsqueda"><i class="pi pi-times"></i></button>
          </div>
        </div>
        <div class="field-block">
          <span>Edificio</span>
          <select [ngModel]="filters.buildingId" (ngModelChange)="onBuildingChange($event)" name="building">
            <option value="">Todos los edificios</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </div>
        <p-button type="button" label="Limpiar" icon="pi pi-times" severity="secondary" [outlined]="true" size="small"
                  (onClick)="resetFilters()" [disabled]="!hasFilters"></p-button>
      </div>

      <!-- Contadores del alcance: sirven de filtro rápido por estado -->
      <div class="chip-row" *ngIf="page">
        <span class="chip-label">Estado</span>
        <button type="button" class="chip-btn" [class.active]="filters.status === ''" (click)="setStatus('')">Todas <strong>{{ page.counts.total }}</strong></button>
        <button type="button" class="chip-btn" [class.active]="filters.status === 'active'" (click)="setStatus('active')">Activas <strong>{{ page.counts.active }}</strong></button>
        <button type="button" class="chip-btn" [class.active]="filters.status === 'inactive'" (click)="setStatus('inactive')">Inactivas <strong>{{ page.counts.inactive }}</strong></button>
        <button type="button" class="chip-btn" [class.active]="filters.status === 'lateFeeExempt'" (click)="setStatus('lateFeeExempt')">Sin mora <strong>{{ page.counts.lateFeeExempt }}</strong></button>
      </div>

      <!-- Atajos por piso (solo con un edificio elegido) -->
      <div class="chip-row" *ngIf="page && page.floors.length > 1">
        <span class="chip-label">Piso</span>
        <button type="button" class="chip-btn" [class.active]="filters.floor === ''" (click)="setFloor('')">Todos</button>
        <button type="button" class="chip-btn" *ngFor="let f of page.floors" [class.active]="filters.floor === f" (click)="setFloor(f)">{{ f }}</button>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading && !page">Cargando unidades...</p>
      <p class="app-state" *ngIf="page && !page.items.length && !pageError">
        {{ hasFilters ? 'Ninguna unidad coincide con la búsqueda o los filtros.' : 'No hay unidades registradas.' }}
      </p>

      <div class="app-list" *ngIf="page && page.items.length" [class.is-loading]="loading">
        <div class="app-row header" [ngClass]="gridClass">
          <span>Código</span>
          <span *ngIf="!filters.buildingId">Edificio</span>
          <span>Piso</span>
          <span>Coeficiente</span>
          <span>Estado</span>
        </div>
        <div class="app-row" [ngClass]="gridClass" *ngFor="let u of page.items; trackBy: trackUnit">
          <button class="row-link" (click)="goToEdit(u.id)" [disabled]="!canEdit">{{ u.code }}</button>
          <span class="building-col" *ngIf="!filters.buildingId">{{ u.buildingName }}</span>
          <span class="floor-col">{{ u.floor }}</span>
          <span class="coef-col">{{ u.coefficient | number:'1.2-6' }}</span>
          <span class="state-col">
            <p-tag [value]="u.isActive ? 'Activo' : 'Inactivo'"
                   [severity]="u.isActive ? 'success' : 'secondary'"></p-tag>
            <p-tag *ngIf="u.lateFeeExempt" value="Sin mora" severity="warn" [title]="'Exonerada de mora: ' + (u.lateFeeExemptReason || '')"></p-tag>
          </span>
        </div>
      </div>

      <app-list-pager *ngIf="page" [page]="page.page" [pageSize]="page.pageSize" [totalCount]="page.totalCount"
                      (pageChange)="goToPage($event)" (pageSizeChange)="setPageSize($event)"></app-list-pager>
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
    .grid-unit { grid-template-columns: 1fr 0.7fr 1fr 1fr; }
    .grid-unit-bld { grid-template-columns: 1fr 1.4fr 0.7fr 1fr 1fr; }
    .building-col { color:var(--brand-ink); font-size:0.9rem; }
    .state-col { display: flex; gap: 0.35rem; flex-wrap: wrap; align-items: center; }
    .floor-col { color:var(--brand-muted); font-size:0.9rem; }
    .coef-col  { font-family:monospace; font-size:0.88rem; color:var(--brand-ink); }

    .row-link {
      background:none; border:none; padding:0; font:inherit; font-weight:700;
      color:var(--brand-blue); cursor:pointer; text-align:left;
      text-decoration:underline dotted;
    }
    .row-link:hover:not(:disabled) { color:var(--brand-ink); }
    .row-link:disabled { color:var(--brand-muted); cursor:default; text-decoration:none; }
    ${LIST_FILTERS_STYLES}
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

  buildings: Building[] = [];
  page: UnitPage | null = null;
  filters: UnitFilters = loadListState<UnitFilters>(STATE_KEY, { search: '', buildingId: '', floor: '', status: '', pageSize: 25 });
  private pageNumber = 1;
  private readonly reload$ = new Subject<void>();
  private readonly search$ = new Subject<string>();
  private appliedSearch = this.filters.search.trim();

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

  get hasFilters(): boolean {
    return !!(this.filters.search || this.filters.buildingId || this.filters.floor || this.filters.status);
  }

  // Con un solo edificio elegido no hace falta la columna del edificio.
  get gridClass(): string { return this.filters.buildingId ? 'grid-unit' : 'grid-unit-bld'; }

  trackUnit = (_: number, u: Unit): string => u.id;

  ngOnInit(): void {
    // Un solo flujo de carga: si se pide otra página antes de que llegue la anterior, la vieja se descarta.
    this.reload$.pipe(
      tap(() => { this.loading = true; this.pageError = ''; this.cdr.markForCheck(); }),
      switchMap(() => this.unitsApi.getPaged({
        search: this.filters.search,
        buildingId: this.filters.buildingId,
        floor: this.filters.floor,
        status: this.filters.status,
        page: this.pageNumber,
        pageSize: this.filters.pageSize
      }).pipe(catchError(() => {
        this.pageError = 'No se pudieron cargar las unidades.';
        return of(null);
      }))),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(result => {
      this.loading = false;
      if (result) {
        // La página pedida ya no existe (se filtró o se borraron unidades): se vuelve a la última que haya.
        if (!result.items.length && result.totalCount > 0 && this.pageNumber > 1) {
          this.pageNumber = Math.ceil(result.totalCount / result.pageSize);
          this.reload$.next();
          return;
        }
        this.page = result;
      }
      this.cdr.markForCheck();
    });

    // Se busca al dejar de escribir, no en cada tecla.
    this.search$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(text => {
      if (text === this.appliedSearch) return;
      this.appliedSearch = text;
      this.filters.search = text;
      this.pageNumber = 1;
      this.changed();
    });

    this.buildingsApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: buildings => {
        this.buildings = [...buildings].sort((x, y) => x.name.localeCompare(y.name));
        // El edificio recordado puede haberse dado de baja o ya no ser accesible.
        if (this.filters.buildingId && !this.buildings.some(b => b.id === this.filters.buildingId)) {
          this.filters.buildingId = '';
          this.filters.floor = '';
        }
        this.load();
      },
      error: () => this.load()
    });
  }

  private load(): void { this.reload$.next(); }

  private changed(): void {
    saveListState(STATE_KEY, this.filters);
    this.load();
  }

  onSearchInput(value: string): void {
    this.filters.search = value ?? '';
    this.search$.next((value ?? '').trim());
  }

  clearSearch(): void {
    this.filters.search = '';
    this.appliedSearch = '';
    this.pageNumber = 1;
    this.changed();
  }

  onBuildingChange(buildingId: string): void {
    this.filters.buildingId = buildingId ?? '';
    this.filters.floor = '';   // los pisos son de cada edificio
    this.pageNumber = 1;
    this.changed();
  }

  setStatus(status: UnitStatusFilter): void {
    this.filters.status = status;
    this.pageNumber = 1;
    this.changed();
  }

  setFloor(floor: string): void {
    this.filters.floor = floor;
    this.pageNumber = 1;
    this.changed();
  }

  resetFilters(): void {
    this.filters = { ...this.filters, search: '', buildingId: '', floor: '', status: '' };
    this.appliedSearch = '';
    this.pageNumber = 1;
    this.changed();
  }

  goToPage(p: number): void {
    this.pageNumber = p;
    this.load();
  }

  setPageSize(size: number): void {
    this.filters.pageSize = size;
    this.pageNumber = 1;
    this.changed();
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
