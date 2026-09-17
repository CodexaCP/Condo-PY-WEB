import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AutoCompleteCompleteEvent, AutoComplete } from 'primeng/autocomplete';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { UnitOwnersApiService } from '../../api/unit-owners-api.service';
import { OwnersApiService } from '../../api/owners-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { ResidentsApiService } from '../../api/residents-api.service';
import { AssignmentsApiService } from '../../api/assignments-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Assignment, Owner, Resident, Unit, UnitOwnerAssignment } from '../../api/models';
import { AuthService } from '../../auth/auth.service';

type UnitOption = Unit & { display: string };

@Component({
  standalone: true,
  selector: 'app-assignments-page',
  imports: [CommonModule, FormsModule, RouterLink, AutoComplete, Button, Card, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Asignaciones</h1>
            <p>Asignación de propietarios y residentes a unidades, todo desde la misma pantalla.</p>
          </div>
        </div>
      </div>

      <!-- Unit search -->
      <div class="search-row">
        <div class="search-wrap">
          <label class="search-label">Buscar unidad</label>
          <p-autoComplete
            [(ngModel)]="selectedUnit"
            [suggestions]="unitSuggestions"
            (completeMethod)="searchUnits($event)"
            (onSelect)="onUnitSelected()"
            (onClear)="clearUnit()"
            [forceSelection]="true"
            [dropdown]="true"
            optionLabel="display"
            placeholder="Escribi el codigo o edificio..."
            styleClass="unit-autocomplete"
            appendTo="body">
            <ng-template #item let-unit>
              <div class="unit-option">
                <span class="unit-option-code">{{ unit.code }}</span>
                <span class="unit-option-building">{{ unit.buildingName }}</span>
              </div>
            </ng-template>
          </p-autoComplete>
        </div>
      </div>

      <!-- Assignment panel for selected unit -->
      <div class="assign-panel" *ngIf="selectedUnit">
        <div class="assign-panel-head">
          <div class="assign-unit-badge">{{ selectedUnit.code }}</div>
          <div>
            <h2>{{ selectedUnit.buildingName }}</h2>
            <p>Piso {{ selectedUnit.floor }} · Coef. {{ selectedUnit.coefficient.toFixed(4) }}</p>
          </div>
        </div>

        <div class="current-owners" *ngIf="currentPrimary || currentSecondary">
          <div class="owner-chip primary-chip" *ngIf="currentPrimary">
            <span class="dot"></span>
            <div>
              <small>Propietario principal</small>
              <strong>{{ currentPrimary.ownerName }}</strong>
              <small class="since">Desde {{ currentPrimary.startDate }}</small>
            </div>
            <button *ngIf="!isReadOnly" type="button" class="remove-btn" title="Quitar" (click)="removeOwner(currentPrimary)">
              <span class="pi pi-times"></span>
            </button>
          </div>
          <div class="owner-chip secondary-chip" *ngIf="currentSecondary">
            <span class="dot dot-2"></span>
            <div>
              <small>Propietario 2</small>
              <strong>{{ currentSecondary.ownerName }}</strong>
              <small class="since">Desde {{ currentSecondary.startDate }}</small>
            </div>
            <button *ngIf="!isReadOnly" type="button" class="remove-btn" title="Quitar" (click)="removeOwner(currentSecondary)">
              <span class="pi pi-times"></span>
            </button>
          </div>
        </div>
        <p class="no-owners" *ngIf="!currentPrimary && !currentSecondary">Esta unidad no tiene propietarios asignados.</p>

        <!-- Add owner form -->
        <form class="add-form" *ngIf="!isReadOnly && canAddMore" (ngSubmit)="addOwner()">
          <div class="add-form-fields">
            <label class="field-block">
              <span>{{ !currentPrimary ? 'Propietario principal *' : 'Propietario 2 (opcional)' }}</span>
              <select [(ngModel)]="addForm.ownerId" name="ownerId" required>
                <option value="">— Seleccionar propietario —</option>
                <option *ngFor="let o of availableOwners" [value]="o.id">{{ o.fullName }}</option>
              </select>
            </label>
            <label class="field-block">
              <span>Vigente desde</span>
              <input type="date" [(ngModel)]="addForm.startDate" name="startDate" required />
            </label>
          </div>
          <div class="add-form-actions">
            <p-button
              type="submit"
              [label]="!currentPrimary ? 'Asignar propietario principal' : 'Asignar propietario 2'"
              icon="pi pi-user-plus"
              [loading]="isSaving"
              [disabled]="!addForm.ownerId">
            </p-button>
          </div>
        </form>

        <p class="max-owners" *ngIf="!isReadOnly && !canAddMore">
          <span class="pi pi-info-circle"></span> La unidad ya tiene sus 2 propietarios asignados. Quitá uno para agregar otro.
        </p>

        <!-- Residentes de la unidad seleccionada -->
        <div class="residents-block">
          <h3 class="subsection-title">Residentes</h3>

          <div class="current-residents" *ngIf="currentResidents.length">
            <div class="resident-chip" *ngFor="let r of currentResidents" [class.ended-chip]="!!r.endDate">
              <span class="dot" [class.dot-ended]="!!r.endDate"></span>
              <div>
                <small>{{ r.isPrimary ? 'Residente principal' : 'Residente' }}</small>
                <strong>{{ r.residentName }}</strong>
                <small class="since">
                  Desde {{ r.startDate }}
                  <span *ngIf="r.endDate"> · Finalizada el {{ r.endDate }}</span>
                </small>
              </div>
              <button *ngIf="!r.endDate && !isReadOnly" type="button" class="remove-btn"
                      title="Finalizar residencia" [disabled]="isSavingResident"
                      (click)="endResidentResidency(r)">
                <span class="pi pi-times"></span>
              </button>
            </div>
          </div>
          <p class="no-owners" *ngIf="!currentResidents.length">Esta unidad no tiene residentes asignados.</p>

          <form class="add-form" *ngIf="!isReadOnly" (ngSubmit)="addResident()">
            <div class="add-form-fields">
              <label class="field-block">
                <span>Residente</span>
                <select [(ngModel)]="residentAddForm.residentId" name="residentId" required>
                  <option value="">— Seleccionar residente —</option>
                  <option *ngFor="let r of availableResidents" [value]="r.id">{{ r.fullName }}</option>
                </select>
              </label>
              <label class="field-block">
                <span>Vigente desde</span>
                <input type="date" [(ngModel)]="residentAddForm.startDate" name="residentStartDate" required />
              </label>
            </div>
            <div class="add-form-actions residents-form-actions">
              <label class="checkbox-inline">
                <input type="checkbox" [(ngModel)]="residentAddForm.isPrimary" name="residentIsPrimary" />
                <span>Es el residente principal (aparece en comprobantes; no hace falta que sea el único con acceso a la app)</span>
              </label>
              <p-button type="submit" label="Asignar residente" icon="pi pi-user-plus"
                        [loading]="isSavingResident" [disabled]="!residentAddForm.residentId">
              </p-button>
            </div>
          </form>
          <small class="field-hint">
            Podés asignar varios residentes a la misma unidad (ej. familia conviviendo). Que tengan
            acceso a la app depende de si tienen una cuenta de usuario creada con su mismo correo
            desde <a routerLink="/users">Usuarios</a> — asignar la unidad aquí no crea esa cuenta.
          </small>
        </div>
      </div>

      <p class="app-state" *ngIf="loading">Cargando...</p>

      <!-- All assignments list -->
      <ng-container *ngIf="!loading && assignments.length">
        <h3 class="section-title">Todas las asignaciones</h3>
        <div class="app-list">
          <div class="app-row header owners-grid">
            <span>Unidad</span>
            <span>Edificio</span>
            <span>Propietario</span>
            <span>Tipo</span>
            <span>Residente</span>
            <span>Desde</span>
            <span *ngIf="!isReadOnly"></span>
          </div>
          <div class="app-row owners-grid" *ngFor="let item of assignments">
            <strong>{{ item.unitCode }}</strong>
            <span>{{ item.buildingName }}</span>
            <span>{{ item.ownerName }}</span>
            <p-tag
              [value]="item.isPrimary ? 'Principal' : 'Secundario'"
              [severity]="item.isPrimary ? 'info' : 'secondary'">
            </p-tag>
            <span [class.no-resident]="!residentNameForUnit(item.unitId)">
              {{ residentNameForUnit(item.unitId) || 'Sin residente asociado' }}
            </span>
            <span>{{ item.startDate }}</span>
            <div *ngIf="!isReadOnly">
              <p-button
                type="button"
                icon="pi pi-trash"
                severity="danger"
                [rounded]="true"
                [text]="true"
                size="small"
                [disabled]="isSaving"
                (onClick)="removeOwner(item)">
              </p-button>
            </div>
          </div>
        </div>
      </ng-container>

      <p class="app-state" *ngIf="!loading && !assignments.length">No hay propietarios asignados.</p>

      <!-- All resident assignments list -->
      <ng-container *ngIf="!loading && residentAssignments.length">
        <h3 class="section-title">Todas las asignaciones de residentes</h3>
        <div class="app-list">
          <div class="app-row header assign-grid">
            <span>Unidad</span>
            <span>Edificio</span>
            <span>Residente</span>
            <span>Tipo</span>
            <span>Desde / Hasta</span>
            <span *ngIf="!isReadOnly"></span>
          </div>
          <div class="app-row assign-grid" *ngFor="let item of residentAssignments" [class.ended-row]="!!item.endDate">
            <strong>{{ item.unitCode }}</strong>
            <span>{{ item.buildingName }}</span>
            <span>{{ item.residentName }}</span>
            <p-tag
              [value]="item.isPrimary ? 'Principal' : 'Residente'"
              [severity]="item.isPrimary ? 'info' : 'secondary'">
            </p-tag>
            <span>{{ item.startDate }}<span *ngIf="item.endDate"> — {{ item.endDate }}</span></span>
            <div *ngIf="!isReadOnly">
              <p-button
                *ngIf="!item.endDate"
                type="button"
                icon="pi pi-times"
                severity="danger"
                [rounded]="true"
                [text]="true"
                size="small"
                title="Finalizar residencia"
                [disabled]="isSavingResident"
                (onClick)="endResidentResidency(item)">
              </p-button>
            </div>
          </div>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .search-row {
      margin-bottom: 1.5rem;
    }
    .search-wrap {
      display: grid;
      gap: 0.5rem;
      max-width: 480px;
    }
    .search-label {
      font-weight: 700;
      color: #29484f;
      font-size: 0.9rem;
    }
    :host ::ng-deep .unit-autocomplete {
      width: 100%;
    }
    :host ::ng-deep .unit-autocomplete .p-autocomplete-input {
      width: 100%;
      border-radius: 14px;
      border: 1.5px solid #d7e5e1;
      padding: 0.85rem 1rem;
      font: inherit;
    }
    :host ::ng-deep .unit-autocomplete .p-autocomplete-input:focus {
      border-color: var(--brand-blue, #1385b6);
      box-shadow: 0 0 0 3px rgba(19,133,182,0.12);
    }
    .unit-option {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.25rem 0;
    }
    .unit-option-code {
      font-weight: 800;
      color: var(--brand-ink, #18353a);
      min-width: 70px;
    }
    .unit-option-building {
      color: var(--brand-muted, #6b878d);
      font-size: 0.88rem;
    }

    /* Assignment panel */
    .assign-panel {
      background: rgba(255,255,255,0.9);
      border: 1.5px solid var(--brand-blue, #1385b6);
      border-radius: 22px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 6px 20px rgba(19,133,182,0.10);
    }
    .assign-panel-head {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .assign-unit-badge {
      background: var(--brand-gradient, linear-gradient(135deg,#1385b6,#0fa090));
      color: white;
      font-size: 1.15rem;
      font-weight: 800;
      border-radius: 14px;
      padding: 0.6rem 1rem;
      white-space: nowrap;
    }
    .assign-panel-head h2 { margin: 0; color: var(--brand-ink, #18353a); }
    .assign-panel-head p { margin: 0.2rem 0 0; color: var(--brand-muted, #6b878d); font-size: 0.85rem; }

    /* Owner chips */
    .current-owners {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .owner-chip {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border-radius: 16px;
      flex: 1;
      min-width: 220px;
    }
    .primary-chip {
      background: rgba(19,133,182,0.07);
      border: 1.5px solid rgba(19,133,182,0.2);
    }
    .secondary-chip {
      background: rgba(15,160,144,0.06);
      border: 1.5px solid rgba(15,160,144,0.2);
    }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--brand-blue, #1385b6);
      flex-shrink: 0;
    }
    .dot-2 { background: #0fa090; }
    .owner-chip > div { flex: 1; display: grid; gap: 0.15rem; }
    .owner-chip small { color: var(--brand-muted, #6b878d); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .owner-chip strong { color: var(--brand-ink, #18353a); font-size: 0.95rem; }
    .since { font-weight: 400 !important; font-size: 0.78rem !important; text-transform: none !important; letter-spacing: 0 !important; }
    .remove-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #94a3b8;
      padding: 0.35rem;
      border-radius: 8px;
      transition: background 0.1s, color 0.1s;
      line-height: 1;
    }
    .remove-btn:hover { background: rgba(201,77,63,0.1); color: #c94d3f; }

    .no-owners { color: var(--brand-muted, #6b878d); margin: 0 0 1.25rem; font-style: italic; }

    /* Add form */
    .add-form {
      border-top: 1px solid rgba(19,133,182,0.12);
      padding-top: 1.25rem;
      display: grid;
      gap: 1rem;
    }
    .add-form-fields {
      display: grid;
      grid-template-columns: 1fr 200px;
      gap: 1rem;
      align-items: end;
    }
    .field-block { display: grid; gap: 0.45rem; }
    .field-block > span { font-weight: 700; color: #29484f; font-size: 0.88rem; }
    .field-block select,
    .field-block input {
      border: 1.5px solid #d7e5e1;
      border-radius: 14px;
      padding: 0.85rem 1rem;
      font: inherit;
      background: white;
      color: #18353a;
      width: 100%;
      box-sizing: border-box;
    }
    .field-block select:focus,
    .field-block input:focus {
      outline: none;
      border-color: var(--brand-blue, #1385b6);
      box-shadow: 0 0 0 3px rgba(19,133,182,0.12);
    }
    .add-form-actions { display: flex; justify-content: flex-end; }

    .max-owners {
      color: var(--brand-muted, #6b878d);
      font-size: 0.88rem;
      border-top: 1px solid rgba(19,133,182,0.12);
      padding-top: 1rem;
      margin: 0;
    }
    .max-owners .pi { margin-right: 0.35rem; }

    /* Residents block */
    .residents-block {
      border-top: 1px solid rgba(19,133,182,0.12);
      margin-top: 1.5rem;
      padding-top: 1.25rem;
    }
    .subsection-title { color: var(--brand-ink, #18353a); margin: 0 0 1rem; font-size: 0.95rem; font-weight: 700; }
    .current-residents { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem; }
    .resident-chip {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem;
      border-radius: 16px; flex: 1; min-width: 220px;
      background: rgba(15,160,144,0.06); border: 1.5px solid rgba(15,160,144,0.2);
    }
    .resident-chip.ended-chip { background: rgba(148,163,184,0.08); border-color: rgba(148,163,184,0.25); opacity: 0.75; }
    .dot-ended { background: #94a3b8; }
    .resident-chip > div { flex: 1; display: grid; gap: 0.15rem; }
    .resident-chip small { color: var(--brand-muted, #6b878d); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .resident-chip strong { color: var(--brand-ink, #18353a); font-size: 0.95rem; }
    .residents-form-actions { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .checkbox-inline { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--brand-muted, #6b878d); cursor: pointer; }
    .checkbox-inline input { accent-color: var(--brand-blue, #1385b6); }
    .field-hint { display: block; color: var(--brand-muted, #6b878d); font-size: 0.8rem; margin-top: 0.9rem; line-height: 1.4; }
    .ended-row { opacity: 0.6; }

    /* List */
    .section-title { color: var(--brand-ink, #18353a); margin: 0 0 0.75rem; font-size: 1rem; }
    .assign-grid { grid-template-columns: 0.7fr 1fr 1fr 0.7fr 0.8fr 48px; }
    .owners-grid { grid-template-columns: 0.7fr 1fr 1fr 0.7fr 1fr 0.8fr 48px; }
    .no-resident { color: var(--brand-muted, #6b878d); font-style: italic; }

    @media (max-width: 860px) {
      .add-form-fields { grid-template-columns: 1fr; }
      .assign-grid { grid-template-columns: 1fr; }
      .owners-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class AssignmentsPageComponent implements OnInit {
  private readonly unitOwnersApi = inject(UnitOwnersApiService);
  private readonly ownersApi = inject(OwnersApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly residentsApi = inject(ResidentsApiService);
  private readonly assignmentsApi = inject(AssignmentsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get isReadOnly(): boolean { return this.auth.hasRole('CompanyAdmin'); }

  units: UnitOption[] = [];
  owners: Owner[] = [];
  assignments: UnitOwnerAssignment[] = [];
  unitSuggestions: UnitOption[] = [];

  residents: Resident[] = [];
  residentAssignments: Assignment[] = [];
  isSavingResident = false;
  residentAddForm = this.emptyResidentAddForm();

  selectedUnit: UnitOption | null = null;
  loading = true;
  isSaving = false;
  addForm = this.emptyAddForm();

  get currentPrimary(): UnitOwnerAssignment | null {
    return this.assignments.find(a => a.unitId === this.selectedUnit?.id && a.isPrimary) ?? null;
  }

  get currentSecondary(): UnitOwnerAssignment | null {
    return this.assignments.find(a => a.unitId === this.selectedUnit?.id && !a.isPrimary) ?? null;
  }

  get canAddMore(): boolean {
    return !this.currentPrimary || !this.currentSecondary;
  }

  get availableOwners(): Owner[] {
    if (!this.selectedUnit) return this.owners;
    const usedIds = new Set(
      this.assignments
        .filter(a => a.unitId === this.selectedUnit!.id)
        .map(a => a.ownerId)
    );
    return this.owners.filter(o => !usedIds.has(o.id));
  }

  get currentResidents(): Assignment[] {
    if (!this.selectedUnit) return [];
    return this.residentAssignments
      .filter(a => a.unitId === this.selectedUnit!.id)
      .sort((a, b) => (a.endDate ? 1 : 0) - (b.endDate ? 1 : 0));
  }

  get availableResidents(): Resident[] {
    if (!this.selectedUnit) return this.residents;
    const activeIds = new Set(
      this.residentAssignments
        .filter(a => a.unitId === this.selectedUnit!.id && !a.endDate)
        .map(a => a.residentId)
    );
    return this.residents.filter(r => !activeIds.has(r.id));
  }

  residentNameForUnit(unitId: string): string {
    const active = this.residentAssignments.filter(a => a.unitId === unitId && !a.endDate);
    if (active.length === 0) return '';
    const primary = active.find(a => a.isPrimary);
    return (primary ?? active[0]).residentName;
  }

  ngOnInit(): void {
    forkJoin({
      assignments: this.unitOwnersApi.getAll(),
      units: this.unitsApi.getAll(),
      owners: this.ownersApi.getAll(true),
      residents: this.residentsApi.getAll(),
      residentAssignments: this.assignmentsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ assignments, units, owners, residents, residentAssignments }) => {
        this.assignments = assignments;
        this.units = units.map(u => ({ ...u, display: `${u.code} — ${u.buildingName}` }));
        this.owners = owners;
        this.residents = residents;
        this.residentAssignments = residentAssignments;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar los datos.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  searchUnits(event: AutoCompleteCompleteEvent): void {
    const query = event.query.toLowerCase();
    this.unitSuggestions = this.units.filter(u =>
      u.code.toLowerCase().includes(query) ||
      u.buildingName.toLowerCase().includes(query) ||
      u.floor.toLowerCase().includes(query)
    );
  }

  onUnitSelected(): void {
    this.addForm = this.emptyAddForm();
    this.residentAddForm = this.emptyResidentAddForm();
    this.cdr.markForCheck();
  }

  clearUnit(): void {
    this.selectedUnit = null;
    this.addForm = this.emptyAddForm();
    this.residentAddForm = this.emptyResidentAddForm();
    this.cdr.markForCheck();
  }

  addOwner(): void {
    if (!this.selectedUnit || !this.addForm.ownerId) return;

    const isPrimary = !this.currentPrimary;
    this.isSaving = true;

    this.unitOwnersApi.create({
      unitId: this.selectedUnit.id,
      ownerId: this.addForm.ownerId,
      isPrimary,
      startDate: this.addForm.startDate
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (created) => {
        this.assignments = [...this.assignments, created];
        this.addForm = this.emptyAddForm();
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Guardado', detail: 'Propietario asignado correctamente.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo asignar el propietario.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  removeOwner(item: UnitOwnerAssignment): void {
    this.isSaving = true;
    this.unitOwnersApi.delete(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.assignments = this.assignments.filter(a => a.id !== item.id);
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Quitado', detail: 'Propietario quitado de la unidad.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo quitar el propietario.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  addResident(): void {
    if (!this.selectedUnit || !this.residentAddForm.residentId) return;

    this.isSavingResident = true;
    this.assignmentsApi.create({
      unitId: this.selectedUnit.id,
      residentId: this.residentAddForm.residentId,
      isPrimary: this.residentAddForm.isPrimary,
      startDate: this.residentAddForm.startDate,
      endDate: null
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (created) => {
        this.residentAssignments = [...this.residentAssignments, created];
        this.residentAddForm = this.emptyResidentAddForm();
        this.isSavingResident = false;
        this.msg.add({ severity: 'success', summary: 'Guardado', detail: 'Residente asignado correctamente.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo asignar el residente.'), life: 5000 });
        this.isSavingResident = false;
        this.cdr.markForCheck();
      }
    });
  }

  endResidentResidency(item: Assignment): void {
    this.isSavingResident = true;
    this.assignmentsApi.endResidency(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.residentAssignments = this.residentAssignments.map(a => a.id === updated.id ? updated : a);
        this.isSavingResident = false;
        this.msg.add({ severity: 'success', summary: 'Guardado', detail: 'Residencia finalizada correctamente.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo finalizar la residencia.'), life: 5000 });
        this.isSavingResident = false;
        this.cdr.markForCheck();
      }
    });
  }

  private emptyAddForm() {
    return { ownerId: '', startDate: new Date().toISOString().slice(0, 10) };
  }

  private emptyResidentAddForm() {
    return { residentId: '', isPrimary: false, startDate: new Date().toISOString().slice(0, 10) };
  }
}
