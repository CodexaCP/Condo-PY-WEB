import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { CompaniesApiService } from '../../api/companies-api.service';
import { Company, PeopleImportKind, PeopleImportResult, PeopleImportRow } from '../../api/models';
import { PeopleImportApiService } from '../../api/people-import-api.service';
import { AuthService } from '../../auth/auth.service';

const PAGE_STEP = 100;

// Panel de carga masiva desde Excel de propietarios o de residentes. Son dos cargas independientes: cada una con su plantilla,
// su vista previa y su confirmación. Se valida todo antes de guardar y, si hay errores, no se crea nada.
@Component({
  standalone: true,
  selector: 'app-people-import-panel',
  imports: [CommonModule, FormsModule, Button, Message],
  template: `
    <section class="import-panel">
      <div class="import-head">
        <div>
          <h2>{{ title }}</h2>
          <p>{{ intro }}</p>
        </div>
        <button type="button" class="import-close" (click)="closed.emit()" aria-label="Cerrar"><i class="pi pi-times"></i></button>
      </div>

      <label class="company-pick" *ngIf="isSuperAdmin">
        <span>Empresa donde se cargan</span>
        <select [(ngModel)]="companyId" name="importCompany" (ngModelChange)="onCompanyChange()" [disabled]="importing || confirming">
          <option value="">— Elegí la empresa —</option>
          <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
        </select>
      </label>

      <div class="import-actions">
        <p-button label="1. Descargar plantilla" icon="pi pi-download" severity="secondary" [outlined]="true"
                  [loading]="downloading" [disabled]="!companyReady" (onClick)="downloadTemplate()"></p-button>
        <label class="file-btn" [class.disabled]="importing || confirming || !companyReady">
          <i class="pi pi-upload"></i> 2. Elegir archivo completado (.xlsx)
          <input type="file" accept=".xlsx" hidden [disabled]="importing || confirming || !companyReady" (change)="onFile($event)" />
        </label>
        <span class="file-name" *ngIf="file">{{ file.name }}</span>
      </div>

      <p-message *ngIf="error" severity="error" [text]="error"></p-message>
      <p class="app-state" *ngIf="importing">Validando archivo...</p>

      <ng-container *ngIf="result as r">
        <div class="import-summary">
          <span class="chip">{{ r.totalRows }} filas</span>
          <span class="chip ok">{{ r.validRows }} correctas</span>
          <span class="chip bad" *ngIf="r.errorRows">{{ r.errorRows }} con errores</span>
          <span class="chip info">{{ r.newPeople }} {{ r.newPeople === 1 ? 'persona nueva' : 'personas nuevas' }}</span>
          <span class="chip info" *ngIf="r.existingPeople">{{ r.existingPeople }} ya existen</span>
          <span class="chip info">{{ r.newAssignments }} {{ r.newAssignments === 1 ? 'asignación' : 'asignaciones' }} a unidades</span>
          <span class="chip info" *ngIf="r.alreadyAssigned">{{ r.alreadyAssigned }} ya estaban asignadas</span>
        </div>

        <p-message *ngIf="r.message && !r.created" severity="warn" [text]="r.message"></p-message>
        <p-message *ngIf="r.created" severity="success" [text]="r.message || 'Carga completada.'"></p-message>

        <div class="pass-box" *ngIf="r.initialPassword && r.newPeople > 0">
          <i class="pi pi-key"></i>
          <div>
            <strong>Contraseña inicial de las cuentas nuevas: <code>{{ r.initialPassword }}</code></strong>
            <span>Es la misma para todas y deben cambiarla al ingresar por primera vez. Compartila con ellos por un canal seguro.</span>
          </div>
        </div>

        <div class="rows-tools" *ngIf="r.rows.length">
          <label class="only-errors" *ngIf="r.errorRows">
            <input type="checkbox" [(ngModel)]="onlyErrors" name="onlyErrors" (ngModelChange)="limit = PAGE_STEP" /> Mostrar solo las filas con errores
          </label>
          <p-button *ngIf="r.errorRows" label="Descargar los errores (CSV)" icon="pi pi-download" severity="secondary" [outlined]="true" size="small"
                    (onClick)="downloadErrors()"></p-button>
        </div>

        <div class="import-table-wrap" *ngIf="shownRows.length">
          <table class="import-table">
            <thead>
              <tr><th>Fila</th><th>Nombre</th><th>Documento</th><th>Correo</th><th>Edificio</th><th>Unidad</th><th>Resultado</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of shownRows" [class.row-error]="row.error">
                <td>{{ row.rowNumber }}</td>
                <td>{{ row.name }}</td>
                <td class="mono">{{ row.document }}</td>
                <td>{{ row.email }}</td>
                <td>{{ row.building }}</td>
                <td class="mono">{{ row.unit }}</td>
                <td>
                  <span *ngIf="row.error" class="err-text"><i class="pi pi-times-circle"></i> {{ row.error }}</span>
                  <span *ngIf="!row.error" class="ok-text"><i class="pi pi-check"></i> {{ row.person }} · {{ row.assignment }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="more-row" *ngIf="filteredRows.length > limit">
          <span>Mostrando {{ shownRows.length }} de {{ filteredRows.length }} filas.</span>
          <button type="button" class="more-btn" (click)="limit = limit + PAGE_STEP">Ver {{ PAGE_STEP }} más</button>
        </div>

        <div class="import-confirm" *ngIf="!r.created">
          <p-button type="button" [label]="'3. Importar ' + r.validRows + ' filas'" icon="pi pi-check" [loading]="confirming"
                    [disabled]="r.errorRows > 0 || r.validRows === 0" (onClick)="confirmImport()"></p-button>
          <small *ngIf="r.errorRows > 0">Corregí las filas con errores en el Excel y volvé a elegir el archivo: no se crea nada hasta que todas estén correctas.</small>
        </div>
      </ng-container>
    </section>
  `,
  styles: [`
    .import-panel { margin:1rem 0 1.5rem; padding:1.2rem 1.3rem; border:1px solid rgba(19,133,182,0.18); border-radius:18px; background:rgba(19,133,182,0.03); display:flex; flex-direction:column; gap:0.9rem; }
    .import-head { display:flex; justify-content:space-between; gap:1rem; align-items:flex-start; }
    .import-head h2 { margin:0 0 0.2rem; font-size:1.05rem; color:var(--brand-ink); }
    .import-head p { margin:0; font-size:0.86rem; color:var(--brand-muted); }
    .import-close { background:none; border:none; cursor:pointer; color:var(--brand-muted); font-size:1rem; }
    .company-pick { display:flex; flex-direction:column; gap:0.3rem; max-width:24rem; font-size:0.78rem; font-weight:700; color:var(--brand-muted); text-transform:uppercase; letter-spacing:0.04em; }
    .company-pick select { border:1.5px solid rgba(20,54,61,0.18); border-radius:10px; padding:0.45rem 0.65rem; font-size:0.9rem; color:var(--brand-ink); background:#fff; text-transform:none; letter-spacing:normal; font-weight:400; }
    .import-actions { display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; }
    .file-btn { display:inline-flex; align-items:center; gap:0.45rem; padding:0.55rem 1rem; border-radius:999px; border:1px solid rgba(19,133,182,0.35); color:var(--brand-blue); font-weight:600; font-size:0.9rem; cursor:pointer; background:#fff; }
    .file-btn.disabled { opacity:0.6; cursor:not-allowed; }
    .file-name { font-size:0.85rem; color:var(--brand-muted); }
    .import-summary { display:flex; gap:0.5rem; flex-wrap:wrap; }
    .chip { padding:0.25rem 0.75rem; border-radius:999px; font-size:0.8rem; font-weight:600; background:rgba(19,133,182,0.1); color:var(--brand-ink); }
    .chip.ok { background:rgba(106,198,74,0.18); color:#3d7d2d; }
    .chip.bad { background:rgba(201,77,63,0.14); color:#b64233; }
    .chip.info { background:rgba(19,133,182,0.1); color:var(--brand-ink); }
    .pass-box { display:flex; gap:0.8rem; align-items:flex-start; padding:0.8rem 1rem; border-radius:12px; background:rgba(183,121,31,0.1); border:1px solid rgba(183,121,31,0.3); }
    .pass-box .pi { color:#b7791f; margin-top:0.15rem; }
    .pass-box div { display:flex; flex-direction:column; gap:0.2rem; font-size:0.86rem; color:var(--brand-ink); }
    .pass-box code { background:#fff; padding:0.1rem 0.45rem; border-radius:6px; font-size:0.95rem; }
    .pass-box span { color:var(--brand-muted); }
    .rows-tools { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
    .only-errors { display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; color:var(--brand-ink); cursor:pointer; }
    .import-table-wrap { max-height:26rem; overflow:auto; border:1px solid rgba(19,133,182,0.12); border-radius:12px; background:#fff; }
    .import-table { width:100%; border-collapse:collapse; font-size:0.84rem; }
    .import-table th { position:sticky; top:0; background:#eef6fa; text-align:left; padding:0.5rem 0.65rem; font-size:0.74rem; color:var(--brand-muted); }
    .import-table td { padding:0.4rem 0.65rem; border-top:1px solid rgba(19,133,182,0.08); vertical-align:top; }
    .import-table .mono { font-family:monospace; }
    .import-table tr.row-error { background:rgba(201,77,63,0.06); }
    .ok-text { color:#3d7d2d; font-weight:600; }
    .err-text { color:#b64233; font-weight:600; }
    .more-row { display:flex; align-items:center; gap:0.8rem; font-size:0.85rem; color:var(--brand-muted); }
    .more-btn { border:1px solid rgba(19,133,182,0.3); background:#fff; color:var(--brand-blue); border-radius:999px; padding:0.25rem 0.8rem; font:inherit; font-size:0.82rem; font-weight:600; cursor:pointer; }
    .import-confirm { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
    .import-confirm small { color:var(--brand-muted); }
  `]
})
export class PeopleImportPanelComponent implements OnInit {
  @Input({ required: true }) kind!: PeopleImportKind;
  // Se avisa al terminar una carga para que la pantalla recargue su listado.
  @Output() imported = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private readonly api = inject(PeopleImportApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly PAGE_STEP = PAGE_STEP;

  companies: Company[] = [];
  companyId = '';
  file: File | null = null;
  result: PeopleImportResult | null = null;
  error = '';
  downloading = false;
  importing = false;
  confirming = false;
  onlyErrors = true;
  limit = PAGE_STEP;

  get isSuperAdmin(): boolean { return this.auth.hasRole('SuperAdmin'); }
  // El SuperAdmin tiene que elegir la empresa; el administrador de empresa importa siempre en la suya.
  get companyReady(): boolean { return !this.isSuperAdmin || !!this.companyId; }

  get title(): string {
    return this.kind === 'owners' ? 'Importar propietarios desde Excel' : 'Importar residentes desde Excel';
  }

  get intro(): string {
    return this.kind === 'owners'
      ? 'Una fila por persona y unidad. Si la persona ya existe (mismo documento) solo se le asigna la unidad. Edificio y unidad son opcionales: sin ellos solo se da de alta a la persona.'
      : 'Una fila por persona y unidad. Si la persona ya existe (mismo documento) solo se le asigna la unidad. Edificio y unidad son opcionales: sin ellos solo se da de alta la ficha.';
  }

  get filteredRows(): PeopleImportRow[] {
    const rows = this.result?.rows ?? [];
    return this.onlyErrors && this.result?.errorRows ? rows.filter(r => r.error) : rows;
  }

  get shownRows(): PeopleImportRow[] { return this.filteredRows.slice(0, this.limit); }

  ngOnInit(): void {
    if (!this.isSuperAdmin) return;
    this.companiesApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: companies => { this.companies = companies; this.cdr.markForCheck(); }
    });
  }

  onCompanyChange(): void {
    // Otra empresa, otros edificios: lo validado antes ya no vale.
    this.file = null;
    this.result = null;
    this.error = '';
  }

  downloadTemplate(): void {
    this.downloading = true;
    this.api.downloadTemplate(this.kind, this.companyId || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        this.saveBlob(blob, this.kind === 'owners' ? 'plantilla-propietarios.xlsx' : 'plantilla-residentes.xlsx');
        this.downloading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.error = this.errorText(error, 'No se pudo descargar la plantilla.');
        this.downloading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Al elegir el archivo se valida solo (sin guardar) y se muestra la vista previa fila por fila.
  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.file = file;
    this.result = null;
    this.error = '';
    this.importing = true;
    this.onlyErrors = true;
    this.limit = PAGE_STEP;

    this.api.import(this.kind, file, false, this.companyId || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.result = result; this.importing = false; this.cdr.markForCheck(); },
      error: error => {
        this.error = this.errorText(error, 'No se pudo validar el archivo.');
        this.importing = false;
        this.cdr.markForCheck();
      }
    });
  }

  confirmImport(): void {
    const file = this.file;
    if (!file || !this.result || this.result.errorRows > 0 || this.confirming) return;

    this.confirming = true;
    this.error = '';
    this.api.import(this.kind, file, true, this.companyId || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.result = result;
        this.confirming = false;
        if (result.created) this.imported.emit();
        this.cdr.markForCheck();
      },
      error: error => {
        this.error = this.errorText(error, 'No se pudo importar el archivo.');
        this.confirming = false;
        this.cdr.markForCheck();
      }
    });
  }

  // CSV con las filas rechazadas y su motivo, para corregirlas en el Excel sin buscarlas una por una (UTF-8 con BOM para que Excel lo abra bien).
  downloadErrors(): void {
    const rows = (this.result?.rows ?? []).filter(r => r.error);
    if (!rows.length) return;
    const cell = (value: string | number | null | undefined): string => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Fila', 'Nombre', 'Documento', 'Correo', 'Edificio', 'Unidad', 'Error'].map(cell).join(';'),
      ...rows.map(r => [r.rowNumber, r.name, r.document, r.email, r.building, r.unit, r.error].map(cell).join(';'))
    ];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    this.saveBlob(blob, this.kind === 'owners' ? 'errores-propietarios.csv' : 'errores-residentes.csv');
  }

  private errorText(error: unknown, fallback: string): string {
    if ((error as { status?: number })?.status === 403) {
      return 'No tenés permiso para importar personas: solo el Superadministrador y el Administrador de toda la empresa.';
    }
    return extractApiErrorMessage(error, fallback);
  }

  private saveBlob(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }
}
