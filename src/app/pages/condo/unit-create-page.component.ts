import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { Building } from '../../api/models';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-unit-create-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tooltip],
  template: `
    <p-card styleClass="app-page-card">

      <!-- HEADER -->
      <div class="create-header">
        <button class="back-btn" (click)="cancel()" pTooltip="Volver al listado" tooltipPosition="right">
          <i class="pi pi-arrow-left"></i>
        </button>
        <div>
          <h1>{{ isEditing ? 'Editar unidad' : 'Nueva unidad' }}</h1>
          <p>{{ isEditing ? ('Editando: ' + editingCode) : 'Complete los datos para registrar una nueva unidad o local.' }}</p>
        </div>
      </div>

      <p-message *ngIf="loadError" severity="error" [text]="loadError"></p-message>
      <div *ngIf="loading" class="app-state">Cargando datos...</div>

      <form class="create-form" (ngSubmit)="save()" *ngIf="!loading && !loadError">

        <!-- ══ EDIFICIO ══════════════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Edificio <span class="required">*</span></h2>
          <p class="section-desc">Selecciona a qué edificio pertenece esta unidad.</p>

          <!-- Un solo edificio: badge bloqueado -->
          <div class="locked-badge" *ngIf="buildings.length === 1">
            <i class="pi pi-building"></i>
            <span>{{ buildings[0].name }}</span>
            <span class="locked-badge-code">{{ buildings[0].code }}</span>
            <span class="locked-tag">Asignado automáticamente</span>
          </div>

          <!-- Múltiples edificios: selector de cards -->
          <div class="building-grid" *ngIf="buildings.length > 1">
            <div class="building-card"
                 *ngFor="let b of buildings"
                 [class.selected]="form.buildingId === b.id"
                 (click)="selectBuilding(b.id)">
              <div class="building-card-icon">
                <i class="pi pi-building"></i>
              </div>
              <div class="building-card-info">
                <span class="building-card-name">{{ b.name }}</span>
                <span class="building-card-code">{{ b.code }}</span>
                <span class="building-card-addr" *ngIf="b.address">{{ b.address }}</span>
              </div>
              <div class="building-card-check" *ngIf="form.buildingId === b.id">
                <i class="pi pi-check-circle"></i>
              </div>
            </div>
          </div>

          <p class="no-buildings-hint" *ngIf="buildings.length === 0">
            No tienes edificios asignados. Contacta al administrador.
          </p>
        </section>

        <!-- ══ IDENTIFICACIÓN ════════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Identificación</h2>

          <div class="field-row">
            <div class="field">
              <label for="code">
                Código <span class="required">*</span>
                <span class="optional">· Ej: 101, A-01, LOCAL-2</span>
              </label>
              <input id="code" type="text" [(ngModel)]="form.code" name="code"
                     placeholder="Ej. 101 · A-01 · LOCAL-2"
                     maxlength="40" autocomplete="off"
                     (input)="onCodeInput()" />
              <small class="field-hint">
                Solo letras, números y guiones medios. Se convierte a mayúsculas automáticamente.
                No puede repetirse dentro del mismo edificio.
              </small>
            </div>
            <div class="field">
              <label for="floor">Piso <span class="required">*</span></label>
              <input id="floor" type="text" [(ngModel)]="form.floor" name="floor"
                     placeholder="Ej. 1 · PB · Sótano" maxlength="30" autocomplete="off" />
              <small class="field-hint">Nivel donde se encuentra la unidad.</small>
            </div>
          </div>

          <div class="field">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
              <span>Unidad activa</span>
            </label>
            <small class="field-hint" style="margin-top:0.2rem;">
              Las unidades inactivas no participan en el cálculo de expensas.
            </small>
          </div>
        </section>

        <!-- ══ COEFICIENTE ═══════════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Coeficiente</h2>

          <div class="coef-info-box">
            <i class="pi pi-info-circle"></i>
            <p>
              El coeficiente determina la proporción de gastos comunes que corresponde a esta unidad.
              La suma de todos los coeficientes del edificio suele ser <strong>1.0000</strong>.
            </p>
          </div>

          <div class="field coef-field">
            <label for="coefficient">
              Coeficiente <span class="optional">(opcional — por defecto 0)</span>
            </label>
            <div class="coef-input-wrap">
              <input id="coefficient" type="number" [(ngModel)]="form.coefficient" name="coefficient"
                     min="0" max="1" step="0.000001"
                     placeholder="0.000000" class="coef-input" />
              <span class="coef-suffix">de 1.0</span>
            </div>
          </div>
        </section>

        <!-- ══ ACCIONES ══════════════════════════════════════════════ -->
        <section class="form-actions">
          <div class="form-actions-left"></div>
          <div class="form-actions-right">
            <p-button type="button" label="Cancelar" [text]="true" [rounded]="true"
                      severity="secondary" (onClick)="cancel()">
            </p-button>
            <p-button type="submit" [label]="isEditing ? 'Guardar cambios' : 'Crear unidad'"
                      [text]="true" [rounded]="true" [loading]="isSaving"
                      icon="pi pi-check">
            </p-button>
          </div>
        </section>

      </form>
    </p-card>
  `,
  styles: [`
    /* ── HEADER ── */
    .create-header { display:flex; align-items:flex-start; gap:1rem; margin-bottom:2rem; }
    .create-header h1 { margin:0 0 0.25rem; }
    .create-header p  { margin:0; color:var(--brand-muted); }
    .back-btn {
      background:none; border:1px solid rgba(19,133,182,0.2); border-radius:50%;
      width:40px; height:40px; display:grid; place-items:center; cursor:pointer;
      color:var(--brand-muted); transition:background 0.15s,color 0.15s; flex-shrink:0; margin-top:4px;
    }
    .back-btn:hover { background:rgba(19,133,182,0.08); color:var(--brand-blue); }

    /* ── FORM ── */
    .create-form { display:flex; flex-direction:column; gap:2.5rem; }
    .form-section { display:flex; flex-direction:column; gap:1.25rem; }
    .section-title {
      font-size:0.88rem; font-weight:700; text-transform:uppercase; letter-spacing:0.07em;
      color:var(--brand-muted); margin:0 0 0.1rem; padding-bottom:0.5rem;
      border-bottom:1px solid rgba(19,133,182,0.1);
    }
    .section-desc { margin:0; color:var(--brand-muted); font-size:0.88rem; }

    /* ── FIELDS ── */
    .field { display:flex; flex-direction:column; gap:0.4rem; }
    .field label { font-weight:500; font-size:0.92rem; color:var(--brand-ink); }
    .field-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .field input[type=text], .field input[type=number] {
      width:100%; padding:0.6rem 0.85rem; border:1px solid rgba(19,133,182,0.25);
      border-radius:10px; font:inherit; font-size:0.95rem; color:var(--brand-ink);
      background:#fff; transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box;
    }
    .field input:focus {
      outline:none; border-color:var(--brand-blue);
      box-shadow:0 0 0 3px rgba(19,133,182,0.12);
    }
    .field-hint  { color:var(--brand-muted); font-size:0.8rem; line-height:1.4; }
    .required    { color:#e74c3c; font-weight:600; }
    .optional    { font-weight:400; font-size:0.82rem; color:var(--brand-muted); }
    .checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:500; }
    .checkbox-label input[type=checkbox] { width:16px; height:16px; cursor:pointer; accent-color:var(--brand-blue); }

    /* ── BUILDING SELECTOR ── */
    .building-grid {
      display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:0.75rem;
    }
    .building-card {
      display:flex; align-items:center; gap:0.85rem; padding:1rem 1.1rem;
      border:2px solid rgba(19,133,182,0.15); border-radius:16px; background:#fff;
      cursor:pointer; transition:border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .building-card:hover { border-color:rgba(19,133,182,0.35); background:#f7fbfe; }
    .building-card.selected {
      border-color:var(--brand-blue); background:#eef7fd;
      box-shadow:0 0 0 3px rgba(19,133,182,0.1);
    }
    .building-card-icon {
      width:40px; height:40px; border-radius:12px; flex-shrink:0;
      background:rgba(19,133,182,0.1); display:grid; place-items:center;
    }
    .building-card.selected .building-card-icon { background:rgba(19,133,182,0.18); }
    .building-card-icon i { color:var(--brand-blue); font-size:1.1rem; }
    .building-card-info { display:flex; flex-direction:column; flex:1; gap:0.1rem; overflow:hidden; }
    .building-card-name { font-size:0.93rem; font-weight:700; color:var(--brand-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .building-card-code { font-family:monospace; font-size:0.75rem; color:var(--brand-muted); }
    .building-card-addr { font-size:0.78rem; color:var(--brand-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .building-card-check { color:var(--brand-blue); font-size:1.3rem; flex-shrink:0; }

    /* ── LOCKED BADGE ── */
    .locked-badge {
      display:inline-flex; align-items:center; gap:0.65rem; padding:0.8rem 1.1rem;
      border:1.5px solid rgba(19,133,182,0.25); border-radius:14px; background:#f0f8ff;
      font-size:0.93rem; color:var(--brand-ink); font-weight:600; width:fit-content;
    }
    .locked-badge i { color:var(--brand-blue); font-size:1.1rem; }
    .locked-badge-code { font-family:monospace; font-size:0.78rem; color:var(--brand-muted); font-weight:400; }
    .locked-tag {
      font-size:0.72rem; padding:0.15rem 0.55rem; border-radius:20px;
      background:rgba(19,133,182,0.12); color:var(--brand-blue); font-weight:600;
    }
    .no-buildings-hint { color:var(--brand-muted); font-size:0.88rem; font-style:italic; }

    /* ── COEFICIENTE ── */
    .coef-info-box {
      display:flex; align-items:flex-start; gap:0.75rem; padding:0.9rem 1.1rem;
      border-radius:14px; background:#f8fbfd; border:1px solid rgba(19,133,182,0.12);
    }
    .coef-info-box i { color:var(--brand-blue); font-size:1rem; margin-top:2px; flex-shrink:0; }
    .coef-info-box p { margin:0; font-size:0.87rem; color:var(--brand-muted); line-height:1.5; }
    .coef-field { max-width:300px; }
    .coef-input-wrap { display:flex; align-items:center; gap:0.6rem; }
    .coef-input { max-width:200px !important; width:100% !important; }
    .coef-suffix { font-size:0.9rem; color:var(--brand-muted); white-space:nowrap; }

    /* ── FORM ACTIONS ── */
    .form-actions {
      display:flex; justify-content:space-between; align-items:center;
      padding-top:0.75rem; border-top:1px solid rgba(19,133,182,0.08);
    }
    .form-actions-right { display:flex; gap:0.75rem; }

  `]
})
export class UnitCreatePageComponent implements OnInit {
  private readonly unitsApi     = inject(UnitsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly auth         = inject(AuthService);
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly destroyRef   = inject(DestroyRef);
  private readonly cdr          = inject(ChangeDetectorRef);
  private readonly msg          = inject(MessageService);

  buildings: Building[] = [];

  isEditing   = false;
  editingId   = '';
  editingCode = '';
  loading     = true;
  loadError   = '';
  isSaving    = false;

  form = this.emptyForm();

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    forkJoin({
      buildings: this.buildingsApi.getAll(),
      unit:      id ? this.unitsApi.getById(id) : of(null)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ buildings, unit }) => {
        this.buildings = buildings.sort((a, b) => a.name.localeCompare(b.name));

        if (id && !unit) {
          this.loadError = 'No se encontró la unidad solicitada.';
          this.loading   = false;
          this.cdr.markForCheck();
          return;
        }

        if (unit) {
          this.isEditing   = true;
          this.editingId   = id!;
          this.editingCode = unit.code;
          this.form = {
            buildingId:  unit.buildingId,
            code:        unit.code,
            floor:       unit.floor,
            coefficient: unit.coefficient,
            isActive:    unit.isActive
          };
        } else if (this.buildings.length === 1) {
          this.form.buildingId = this.buildings[0].id;
        }

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'No se pudieron cargar los datos necesarios.';
        this.loading   = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectBuilding(id: string): void {
    this.form.buildingId = id;
  }

  onCodeInput(): void {
    this.form.code = this.form.code
      .toUpperCase()
      .replace(/[^A-Z0-9\-]/g, '');
  }

  save(): void {
    const code  = this.form.code.trim().toUpperCase();
    const floor = this.form.floor.trim();

    if (!this.form.buildingId) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Debes seleccionar un edificio.', life: 5000 }); return;
    }
    if (!code) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El código de la unidad es obligatorio.', life: 5000 }); return;
    }
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Código inválido. Solo letras, números y guiones medios.', life: 5000 }); return;
    }
    if (!floor) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El piso es obligatorio.', life: 5000 }); return;
    }

    const req = {
      buildingId:  this.form.buildingId,
      code,
      floor,
      coefficient: Number(this.form.coefficient) || 0,
      isActive:    this.form.isActive
    };

    this.isSaving = true;
    const op = this.isEditing
      ? this.unitsApi.update(this.editingId, req)
      : this.unitsApi.create(req);

    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.isSaving = false;
        if (!this.isEditing) {
          this.isEditing   = true;
          this.editingId   = saved.id;
          this.editingCode = saved.code;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Unidad ${saved.code} creada correctamente.`, life: 4000 });
        } else {
          this.editingCode = saved.code;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Cambios guardados correctamente.', life: 4000 });
        }
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar la unidad.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  cancel(): void { this.router.navigate(['/units']); }

  private emptyForm() {
    return {
      buildingId:  '',
      code:        '',
      floor:       '',
      coefficient: 0,
      isActive:    true
    };
  }
}
