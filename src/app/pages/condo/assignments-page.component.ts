import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { AssignmentsApiService } from '../../api/assignments-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Assignment, Building, Resident, Unit } from '../../api/models';
import { ResidentsApiService } from '../../api/residents-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';

interface UnitOwnerSlots {
  unit: Unit;
  primary: Assignment | null;
  secondary: Assignment | null;
}

@Component({
  standalone: true,
  selector: 'app-assignments-page',
  imports: [CommonModule, FormsModule, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Propietarios</h1>
            <p>Asignacion de propietarios a unidades. Cada unidad puede tener hasta dos.</p>
          </div>
        </div>
      </div>

      <!-- Building filter -->
      <div class="filter-row">
        <label>
          <span>Edificio</span>
          <select [(ngModel)]="selectedBuildingId" name="selectedBuildingId">
            <option value="">Todos los edificios</option>
            <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
          </select>
        </label>
      </div>

      <p class="app-state" *ngIf="loading">Cargando...</p>

      <ng-container *ngIf="!loading">
        <p class="app-state" *ngIf="!filteredSlots.length">No hay unidades para este edificio.</p>

        <!-- Unit cards grid -->
        <div class="units-grid" *ngIf="filteredSlots.length">
          <div class="unit-card"
               *ngFor="let slot of filteredSlots"
               [class.editing]="editingUnitId === slot.unit.id">

            <div class="unit-card-head">
              <div class="unit-badge">{{ slot.unit.code }}</div>
              <span class="building-label">{{ slot.unit.buildingName }}</span>
            </div>

            <div class="owner-slots">
              <!-- Primary owner -->
              <div class="owner-row primary">
                <span class="owner-dot primary-dot"></span>
                <div class="owner-info">
                  <small>Propietario 1</small>
                  <strong *ngIf="slot.primary">{{ slot.primary.residentName }}</strong>
                  <em *ngIf="!slot.primary" class="unassigned">Sin asignar</em>
                </div>
              </div>
              <!-- Secondary owner -->
              <div class="owner-row secondary">
                <span class="owner-dot secondary-dot"></span>
                <div class="owner-info">
                  <small>Propietario 2</small>
                  <strong *ngIf="slot.secondary">{{ slot.secondary.residentName }}</strong>
                  <em *ngIf="!slot.secondary" class="unassigned">Opcional</em>
                </div>
              </div>
            </div>

            <button
              *ngIf="!isReadOnly"
              type="button"
              class="edit-btn"
              [class.active]="editingUnitId === slot.unit.id"
              (click)="toggleEdit(slot)">
              {{ editingUnitId === slot.unit.id ? 'Cancelar' : 'Editar propietarios' }}
            </button>
          </div>
        </div>

        <!-- Edit panel -->
        <div class="edit-panel" *ngIf="editingUnitId && editingSlot">
          <div class="edit-panel-head">
            <span class="pi pi-pencil"></span>
            <h3>Propietarios de <strong>{{ editingSlot.unit.code }}</strong>
              <span class="edit-building">{{ editingSlot.unit.buildingName }}</span>
            </h3>
          </div>

          <form class="edit-form" (ngSubmit)="saveOwners()">
            <div class="edit-fields">
              <label class="field-block required">
                <span>Propietario 1 <em>*</em></span>
                <select [(ngModel)]="editForm.primaryId" name="primaryId">
                  <option value="">— Seleccionar —</option>
                  <option *ngFor="let o of owners" [value]="o.id"
                    [disabled]="o.id === editForm.secondaryId">
                    {{ o.fullName }}
                  </option>
                </select>
              </label>

              <label class="field-block">
                <span>Propietario 2 <em class="opt">opcional</em></span>
                <select [(ngModel)]="editForm.secondaryId" name="secondaryId">
                  <option value="">— Sin segundo propietario —</option>
                  <option *ngFor="let o of owners" [value]="o.id"
                    [disabled]="o.id === editForm.primaryId">
                    {{ o.fullName }}
                  </option>
                </select>
              </label>

              <label class="field-block">
                <span>Vigente desde</span>
                <input type="date" [(ngModel)]="editForm.startDate" name="startDate" required />
              </label>
            </div>

            <div class="edit-actions">
              <p-button type="button" label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelEdit()"></p-button>
              <p-button type="submit" label="Guardar propietarios" icon="pi pi-check" [loading]="isSaving" [disabled]="!editForm.primaryId"></p-button>
            </div>
          </form>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .filter-row {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .filter-row label {
      display: grid;
      gap: 0.4rem;
      color: #29484f;
      font-weight: 700;
    }
    .filter-row select {
      min-width: 280px;
      border: 1px solid #d7e5e1;
      border-radius: 14px;
      padding: 0.85rem 1rem;
      font: inherit;
      background: white;
      color: #18353a;
    }

    /* Unit cards */
    .units-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .unit-card {
      background: rgba(255,255,255,0.88);
      border: 1.5px solid rgba(19,133,182,0.10);
      border-radius: 22px;
      padding: 1.25rem;
      display: grid;
      gap: 1rem;
      transition: box-shadow 0.15s, border-color 0.15s;
    }
    .unit-card:hover {
      box-shadow: 0 6px 18px rgba(19,133,182,0.10);
    }
    .unit-card.editing {
      border-color: var(--brand-blue, #1385b6);
      box-shadow: 0 0 0 3px rgba(19,133,182,0.12), 0 8px 24px rgba(19,133,182,0.12);
      background: var(--brand-gradient-soft, #edf8ff);
    }

    .unit-card-head {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .unit-badge {
      background: var(--brand-gradient, linear-gradient(135deg,#1385b6,#0fa090));
      color: white;
      font-size: 1rem;
      font-weight: 800;
      border-radius: 12px;
      padding: 0.45rem 0.85rem;
      letter-spacing: 0.02em;
    }
    .building-label {
      color: var(--brand-muted, #6b878d);
      font-size: 0.85rem;
      font-weight: 600;
    }

    .owner-slots {
      display: grid;
      gap: 0.6rem;
    }
    .owner-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background: rgba(19,133,182,0.04);
      border-radius: 12px;
      padding: 0.6rem 0.75rem;
    }
    .owner-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .primary-dot { background: var(--brand-blue, #1385b6); }
    .secondary-dot { background: #a8d4e6; }
    .owner-info { display: grid; gap: 0.1rem; min-width: 0; }
    .owner-info small { color: var(--brand-muted, #6b878d); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .owner-info strong { color: var(--brand-ink, #18353a); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .unassigned { color: #b0bec5; font-style: italic; font-size: 0.88rem; }

    .edit-btn {
      width: 100%;
      padding: 0.65rem;
      border: 1.5px solid rgba(19,133,182,0.20);
      border-radius: 12px;
      background: transparent;
      color: var(--brand-blue, #1385b6);
      font: inherit;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .edit-btn:hover { background: rgba(19,133,182,0.07); }
    .edit-btn.active { background: rgba(19,133,182,0.10); border-color: var(--brand-blue,#1385b6); }

    /* Edit panel */
    .edit-panel {
      background: white;
      border: 1.5px solid var(--brand-blue, #1385b6);
      border-radius: 22px;
      padding: 1.5rem 1.75rem;
      margin-bottom: 1rem;
      box-shadow: 0 8px 28px rgba(19,133,182,0.10);
    }
    .edit-panel-head {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      margin-bottom: 1.25rem;
      color: var(--brand-blue, #1385b6);
    }
    .edit-panel-head h3 { margin: 0; font-size: 1.05rem; color: var(--brand-ink, #18353a); }
    .edit-panel-head .pi { font-size: 1.1rem; }
    .edit-building { color: var(--brand-muted, #6b878d); font-weight: 400; margin-left: 0.4rem; font-size: 0.9rem; }

    .edit-form { display: grid; gap: 1.25rem; }
    .edit-fields {
      display: grid;
      grid-template-columns: 1fr 1fr 200px;
      gap: 1rem;
      align-items: end;
    }
    .field-block {
      display: grid;
      gap: 0.5rem;
    }
    .field-block > span {
      font-weight: 700;
      color: #29484f;
      font-size: 0.9rem;
    }
    .field-block > span em {
      color: #c94d3f;
      font-style: normal;
      margin-left: 0.2rem;
    }
    .field-block > span em.opt {
      color: var(--brand-muted, #6b878d);
      font-size: 0.78rem;
      font-style: italic;
      font-weight: 400;
    }
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

    .edit-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
    }

    @media (max-width: 1100px) {
      .units-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .edit-fields { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 700px) {
      .units-grid { grid-template-columns: 1fr; }
      .edit-fields { grid-template-columns: 1fr; }
    }
  `]
})
export class AssignmentsPageComponent implements OnInit {
  private readonly assignmentsApi = inject(AssignmentsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly residentsApi = inject(ResidentsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get isReadOnly(): boolean { return this.auth.hasRole('CompanyAdmin'); }

  buildings: Building[] = [];
  units: Unit[] = [];
  owners: Resident[] = [];        // residents where isOwner === true
  items: Assignment[] = [];       // all assignments
  slots: UnitOwnerSlots[] = [];  // computed per unit
  loading = true;
  isSaving = false;
  selectedBuildingId = '';
  editingUnitId: string | null = null;
  editingSlot: UnitOwnerSlots | null = null;
  editForm = this.emptyForm();

  get filteredSlots(): UnitOwnerSlots[] {
    if (!this.selectedBuildingId) return this.slots;
    return this.slots.filter(s => s.unit.buildingId === this.selectedBuildingId);
  }

  ngOnInit(): void {
    forkJoin({
      assignments: this.assignmentsApi.getAll(),
      units: this.unitsApi.getAll(),
      residents: this.residentsApi.getAll(),
      buildings: this.buildingsApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ assignments, units, residents, buildings }) => {
        this.buildings = buildings;
        this.units = units;
        this.owners = residents.filter(r => r.isOwner);
        this.items = assignments;
        this.buildSlots();
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

  toggleEdit(slot: UnitOwnerSlots): void {
    if (this.editingUnitId === slot.unit.id) {
      this.cancelEdit();
      return;
    }
    this.editingUnitId = slot.unit.id;
    this.editingSlot = slot;
    this.editForm = {
      primaryId: slot.primary?.residentId ?? '',
      secondaryId: slot.secondary?.residentId ?? '',
      startDate: slot.primary?.startDate ?? new Date().toISOString().slice(0, 10)
    };
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingUnitId = null;
    this.editingSlot = null;
    this.editForm = this.emptyForm();
    this.cdr.markForCheck();
  }

  saveOwners(): void {
    if (!this.editingUnitId || !this.editForm.primaryId) return;

    const ownerIds = new Set(this.owners.map(o => o.id));
    const existingOwnerAssignments = this.items.filter(
      a => a.unitId === this.editingUnitId && ownerIds.has(a.residentId)
    );

    const toDelete = existingOwnerAssignments.map(a => this.assignmentsApi.delete(a.id));

    const toCreate = [
      { residentId: this.editForm.primaryId, isPrimary: true },
      ...(this.editForm.secondaryId ? [{ residentId: this.editForm.secondaryId, isPrimary: false }] : [])
    ].map(c => this.assignmentsApi.create({
      unitId: this.editingUnitId!,
      residentId: c.residentId,
      isPrimary: c.isPrimary,
      startDate: this.editForm.startDate,
      endDate: null
    }));

    const unitId = this.editingUnitId!;
    this.isSaving = true;

    const deletions$ = toDelete.length ? forkJoin(toDelete) : of([] as void[]);

    deletions$.pipe(
      switchMap(() => forkJoin(toCreate)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (created) => {
        this.items = [
          ...this.items.filter(a => !(a.unitId === unitId && ownerIds.has(a.residentId))),
          ...created
        ];
        this.buildSlots();
        this.isSaving = false;
        this.cancelEdit();
        this.msg.add({ severity: 'success', summary: 'Guardado', detail: 'Propietarios actualizados correctamente.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudieron guardar los propietarios.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  private buildSlots(): void {
    const ownerIds = new Set(this.owners.map(o => o.id));
    this.slots = this.units.map(unit => {
      const unitOwnerAssignments = this.items.filter(
        a => a.unitId === unit.id && ownerIds.has(a.residentId)
      );
      return {
        unit,
        primary: unitOwnerAssignments.find(a => a.isPrimary) ?? null,
        secondary: unitOwnerAssignments.find(a => !a.isPrimary) ?? null
      };
    }).sort((a, b) =>
      a.unit.buildingName.localeCompare(b.unit.buildingName) ||
      a.unit.code.localeCompare(b.unit.code)
    );
  }

  private emptyForm() {
    return { primaryId: '', secondaryId: '', startDate: new Date().toISOString().slice(0, 10) };
  }
}
