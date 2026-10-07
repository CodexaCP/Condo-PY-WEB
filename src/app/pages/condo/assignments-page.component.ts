import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Select } from 'primeng/select';
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

type UnitOption = Unit & { display: string };
type StatusFilter = 'all' | 'noOwner' | 'noResident' | 'complete';
interface UnitRow {
  unit: UnitOption;
  ownerSummary: string;
  ownerCount: number;
  residentSummary: string;
  residentCount: number;
  search: string;
}

const BUILDING_KEY = 'assignments.buildingId';
const PAGE_SIZE = 25;

@Component({
  standalone: true,
  selector: 'app-assignments-page',
  imports: [CommonModule, FormsModule, RouterLink, Select, Button, Card, Tag],
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

      <!-- Filtros -->
      <div class="filters">
        <label class="filter-block">
          <span>Edificio</span>
          <p-select [options]="buildingOptions" [ngModel]="buildingId" (ngModelChange)="buildingId = $event ?? ''; onFilterChange()"
                    [ngModelOptions]="{ standalone: true }"
                    optionLabel="name" optionValue="id" [filter]="true" filterBy="name" appendTo="body"
                    styleClass="filter-select" placeholder="Todos los edificios"></p-select>
        </label>
        <label class="filter-block filter-grow">
          <span>Buscar</span>
          <input type="text" [ngModel]="search" (ngModelChange)="search = $event; onFilterChange()"
                 placeholder="Unidad, piso, propietario o residente..." />
        </label>
        <label class="filter-block">
          <span>Estado</span>
          <select [ngModel]="status" (ngModelChange)="status = $event; onFilterChange()">
            <option value="all">Todas</option>
            <option value="noOwner">Sin propietario</option>
            <option value="noResident">Sin residente</option>
            <option value="complete">Con propietario y residente</option>
          </select>
        </label>
      </div>

      <div class="scope-summary" *ngIf="!loading">
        <button type="button" class="scope-chip" [class.active]="status === 'noOwner'" (click)="quickStatus('noOwner')">
          Sin propietario: <strong>{{ scopeNoOwner }}</strong>
        </button>
        <button type="button" class="scope-chip" [class.active]="status === 'noResident'" (click)="quickStatus('noResident')">
          Sin residente: <strong>{{ scopeNoResident }}</strong>
        </button>
        <span class="scope-total">Mostrando {{ pagedRows.length }} de {{ filteredRows.length }} unidades</span>
      </div>

      <p class="app-state" *ngIf="loading">Cargando...</p>

      <ng-container *ngIf="!loading">
        <p class="app-state" *ngIf="!filteredRows.length">No hay unidades que coincidan con los filtros.</p>

        <div class="app-list" *ngIf="filteredRows.length">
          <div class="app-row header units-grid">
            <span>Unidad</span>
            <span>Edificio</span>
            <span>Propietario</span>
            <span>Residente</span>
            <span>Estado</span>
            <span></span>
          </div>

          <ng-container *ngFor="let row of pagedRows; trackBy: trackRow">
            <div class="app-row units-grid unit-row" [class.open]="selectedUnit?.id === row.unit.id"
                 (click)="toggleUnit(row.unit)">
              <strong>{{ row.unit.code }} <small class="floor">Piso {{ row.unit.floor }}</small></strong>
              <span>{{ row.unit.buildingName }}</span>
              <span [class.no-resident]="!row.ownerCount">
                {{ row.ownerSummary || 'Sin propietario' }}
              </span>
              <span [class.no-resident]="!row.residentCount">
                {{ row.residentSummary || 'Sin residente' }}
              </span>
              <span class="status-tags">
                <p-tag *ngIf="!row.ownerCount" value="Sin propietario" severity="danger"></p-tag>
                <p-tag *ngIf="!row.residentCount" value="Sin residente" severity="warn"></p-tag>
                <p-tag *ngIf="row.ownerCount && row.residentCount" value="Completa" severity="success"></p-tag>
              </span>
              <span class="chevron pi" [class.pi-chevron-down]="selectedUnit?.id === row.unit.id"
                    [class.pi-chevron-right]="selectedUnit?.id !== row.unit.id"></span>
            </div>

            <!-- Panel de la unidad abierta -->
            <div class="assign-panel" *ngIf="selectedUnit?.id === row.unit.id">
              <div class="assign-panel-head">
                <div class="assign-unit-badge">{{ row.unit.code }}</div>
                <div>
                  <h2>{{ row.unit.buildingName }}</h2>
                  <p>Piso {{ row.unit.floor }} · Coef. {{ row.unit.coefficient.toFixed(4) }}</p>
                </div>
              </div>

              <!-- Propietarios -->
              <button type="button" class="section-toggle" (click)="ownersOpen = !ownersOpen">
                <span class="pi" [class.pi-chevron-down]="ownersOpen" [class.pi-chevron-right]="!ownersOpen"></span>
                <span>Propietarios</span>
                <small>{{ row.ownerCount }} de 2</small>
              </button>
              <div class="section-body" *ngIf="ownersOpen">
                <div class="current-owners" *ngIf="currentPrimary || currentSecondary">
                  <div class="owner-chip primary-chip" *ngIf="currentPrimary">
                    <span class="dot"></span>
                    <div>
                      <small>Propietario principal</small>
                      <strong>{{ currentPrimary.ownerName }}</strong>
                      <small class="since">Desde {{ currentPrimary.startDate }}</small>
                      <small class="since" *ngIf="currentPrimary.ownershipPercentage">Titularidad {{ currentPrimary.ownershipPercentage }}%
                        <button type="button" class="pct-edit" (click)="editOwnership(currentPrimary)" title="Cambiar porcentaje"><span class="pi pi-pencil"></span></button></small>
                      <button type="button" class="pct-add" *ngIf="!currentPrimary.ownershipPercentage" (click)="editOwnership(currentPrimary)">Informar titularidad %</button>
                    </div>
                    <button type="button" class="remove-btn" title="Quitar" [disabled]="isSaving" (click)="removeOwner(currentPrimary)">
                      <span class="pi pi-times"></span>
                    </button>
                  </div>
                  <div class="owner-chip secondary-chip" *ngIf="currentSecondary">
                    <span class="dot dot-2"></span>
                    <div>
                      <small>Propietario 2</small>
                      <strong>{{ currentSecondary.ownerName }}</strong>
                      <small class="since">Desde {{ currentSecondary.startDate }}</small>
                      <small class="since" *ngIf="currentSecondary.ownershipPercentage">Titularidad {{ currentSecondary.ownershipPercentage }}%
                        <button type="button" class="pct-edit" (click)="editOwnership(currentSecondary)" title="Cambiar porcentaje"><span class="pi pi-pencil"></span></button></small>
                      <button type="button" class="pct-add" *ngIf="!currentSecondary.ownershipPercentage" (click)="editOwnership(currentSecondary)">Informar titularidad %</button>
                    </div>
                    <button type="button" class="remove-btn" title="Quitar" [disabled]="isSaving" (click)="removeOwner(currentSecondary)">
                      <span class="pi pi-times"></span>
                    </button>
                  </div>
                </div>
                <p class="no-owners" *ngIf="!currentPrimary && !currentSecondary">Esta unidad no tiene propietarios asignados.</p>

                <form class="add-form" *ngIf="canAddMore" (ngSubmit)="addOwner()">
                  <div class="add-form-fields">
                    <label class="field-block">
                      <span>{{ !currentPrimary ? 'Propietario principal *' : 'Propietario 2 (opcional)' }}</span>
                      <p-select [options]="availableOwners" [(ngModel)]="addForm.ownerId" name="ownerId"
                                optionLabel="fullName" optionValue="id" [filter]="true" filterBy="fullName,documentNumber,email"
                                appendTo="body" placeholder="Buscar propietario..." styleClass="person-select"></p-select>
                    </label>
                    <label class="field-block">
                      <span>Vigente desde</span>
                      <input type="date" [(ngModel)]="addForm.startDate" name="startDate" required />
                    </label>
                    <label class="field-block">
                      <span>Titularidad % <small>(opcional)</small></span>
                      <input type="number" [(ngModel)]="addForm.ownershipPercentage" name="ownershipPercentage" min="0" max="100" step="0.01" placeholder="Ej. 50" />
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

                <p class="max-owners" *ngIf="!canAddMore">
                  <span class="pi pi-info-circle"></span> La unidad ya tiene sus 2 propietarios asignados. Quitá uno para agregar otro.
                </p>
              </div>

              <!-- Residentes -->
              <button type="button" class="section-toggle section-toggle-2" (click)="residentsOpen = !residentsOpen">
                <span class="pi" [class.pi-chevron-down]="residentsOpen" [class.pi-chevron-right]="!residentsOpen"></span>
                <span>Residentes</span>
                <small>{{ row.residentCount }} activo{{ row.residentCount === 1 ? '' : 's' }}</small>
              </button>
              <div class="section-body" *ngIf="residentsOpen">
                <div class="current-residents" *ngIf="activeResidents.length">
                  <div class="resident-chip" *ngFor="let r of activeResidents">
                    <span class="dot"></span>
                    <div>
                      <small>{{ r.isPrimary ? 'Residente principal' : 'Residente' }}</small>
                      <strong>{{ r.residentName }}</strong>
                      <small class="since">Desde {{ r.startDate }}</small>
                    </div>
                    <button type="button" class="remove-btn" title="Finalizar residencia" [disabled]="isSavingResident"
                            (click)="endResidentResidency(r)">
                      <span class="pi pi-times"></span>
                    </button>
                  </div>
                </div>
                <p class="no-owners" *ngIf="!activeResidents.length">Esta unidad no tiene residentes asignados.</p>

                <ng-container *ngIf="endedResidents.length">
                  <button type="button" class="history-toggle" (click)="showHistory = !showHistory">
                    <span class="pi" [class.pi-chevron-down]="showHistory" [class.pi-chevron-right]="!showHistory"></span>
                    Historial de residencias ({{ endedResidents.length }})
                  </button>
                  <div class="current-residents" *ngIf="showHistory">
                    <div class="resident-chip ended-chip" *ngFor="let r of endedResidents">
                      <span class="dot dot-ended"></span>
                      <div>
                        <small>{{ r.isPrimary ? 'Residente principal' : 'Residente' }}</small>
                        <strong>{{ r.residentName }}</strong>
                        <small class="since">Desde {{ r.startDate }} · Finalizada el {{ r.endDate }}</small>
                      </div>
                    </div>
                  </div>
                </ng-container>

                <form class="add-form" (ngSubmit)="addResident()">
                  <div class="add-form-fields">
                    <label class="field-block">
                      <span>Residente</span>
                      <p-select [options]="availableResidents" [(ngModel)]="residentAddForm.residentId" name="residentId"
                                optionLabel="fullName" optionValue="id" [filter]="true" filterBy="fullName,documentNumber,email"
                                appendTo="body" placeholder="Buscar residente..." styleClass="person-select"></p-select>
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
          </ng-container>
        </div>

        <div class="pager" *ngIf="pageCount > 1">
          <p-button icon="pi pi-angle-left" [text]="true" [disabled]="page === 0" (onClick)="goPage(page - 1)"></p-button>
          <span>Página {{ page + 1 }} de {{ pageCount }}</span>
          <p-button icon="pi pi-angle-right" [text]="true" [disabled]="page >= pageCount - 1" (onClick)="goPage(page + 1)"></p-button>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .filters { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; margin-bottom: 0.9rem; }
    .filter-block { display: grid; gap: 0.4rem; min-width: 220px; }
    .filter-block > span { font-weight: 700; color: #29484f; font-size: 0.88rem; }
    .filter-grow { flex: 1; min-width: 260px; }
    .filter-block input, .filter-block select {
      border: 1.5px solid #d7e5e1; border-radius: 14px; padding: 0.7rem 1rem; font: inherit;
      background: white; color: #18353a; width: 100%; box-sizing: border-box;
    }
    .filter-block input:focus, .filter-block select:focus {
      outline: none; border-color: var(--brand-blue, #1385b6); box-shadow: 0 0 0 3px rgba(19,133,182,0.12);
    }
    :host ::ng-deep .filter-select, :host ::ng-deep .person-select { width: 100%; }
    :host ::ng-deep .filter-select { border-radius: 14px; border: 1.5px solid #d7e5e1; min-height: 2.9rem; }
    :host ::ng-deep .person-select { border-radius: 14px; border: 1.5px solid #d7e5e1; min-height: 3rem; }

    .scope-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
    .scope-chip {
      background: rgba(19,133,182,0.06); border: 1.5px solid rgba(19,133,182,0.18); border-radius: 999px;
      padding: 0.3rem 0.85rem; font: inherit; font-size: 0.82rem; color: #29484f; cursor: pointer;
    }
    .scope-chip.active { background: var(--brand-blue, #1385b6); color: white; border-color: transparent; }
    .scope-total { margin-left: auto; color: var(--brand-muted, #6b878d); font-size: 0.82rem; }

    .units-grid { grid-template-columns: 1fr 1fr 1.2fr 1.2fr 1.1fr 32px; }
    .unit-row { cursor: pointer; }
    .unit-row:hover { background: rgba(19,133,182,0.04); }
    .unit-row.open { background: rgba(19,133,182,0.07); }
    .floor { color: var(--brand-muted, #6b878d); font-weight: 400; margin-left: 0.35rem; }
    .status-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .chevron { color: var(--brand-muted, #6b878d); font-size: 0.8rem; }
    .no-resident { color: var(--brand-muted, #6b878d); font-style: italic; }

    .section-toggle, .history-toggle {
      display: flex; align-items: center; gap: 0.6rem; width: 100%; text-align: left;
      background: rgba(19,133,182,0.06); border: none; border-radius: 12px; padding: 0.65rem 0.9rem;
      font: inherit; font-weight: 700; color: var(--brand-ink, #18353a); cursor: pointer; margin-bottom: 0.9rem;
    }
    .section-toggle-2 { background: rgba(15,160,144,0.07); margin-top: 1rem; }
    .section-toggle small { margin-left: auto; font-weight: 400; color: var(--brand-muted, #6b878d); }
    .section-toggle .pi { font-size: 0.78rem; }
    .history-toggle { background: none; font-weight: 600; font-size: 0.85rem; padding: 0.3rem 0; width: auto; color: var(--brand-muted, #6b878d); }
    .section-body { margin-bottom: 0.5rem; }

    .pager { display: flex; justify-content: center; align-items: center; gap: 0.75rem; margin-top: 1rem; color: #29484f; font-size: 0.88rem; }

    /* Assignment panel */
    .assign-panel {
      background: rgba(255,255,255,0.9);
      border: 1.5px solid var(--brand-blue, #1385b6);
      border-radius: 22px;
      padding: 1.5rem;
      margin: 0.5rem 0.75rem 1rem;
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
    .pct-edit, .pct-add { background:none; border:none; padding:0 0.25rem; cursor:pointer; color:var(--brand-blue); font:inherit; font-size:0.78rem; }
    .pct-add { display:block; padding:0; margin-top:0.15rem; text-decoration:underline; }
    .pct-edit .pi { font-size:0.72rem; }
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

    /* Residents */
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

    @media (max-width: 860px) {
      .add-form-fields { grid-template-columns: 1fr; }
      .units-grid { grid-template-columns: 1fr; }
      .scope-total { margin-left: 0; }
    }
  `]
})
export class AssignmentsPageComponent implements OnInit {
  private readonly unitOwnersApi = inject(UnitOwnersApiService);
  private readonly ownersApi = inject(OwnersApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly residentsApi = inject(ResidentsApiService);
  private readonly assignmentsApi = inject(AssignmentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  units: UnitOption[] = [];
  owners: Owner[] = [];
  assignments: UnitOwnerAssignment[] = [];
  residents: Resident[] = [];
  residentAssignments: Assignment[] = [];

  isSavingResident = false;
  residentAddForm = this.emptyResidentAddForm();

  selectedUnit: UnitOption | null = null;
  loading = true;
  isSaving = false;
  addForm = this.emptyAddForm();

  ownersOpen = true;
  residentsOpen = true;
  showHistory = false;

  // Filtros y paginación: la tabla trabaja sobre un índice por unidad armado una sola vez por cambio de datos.
  buildingOptions: { id: string; name: string }[] = [];
  buildingId = '';
  search = '';
  status: StatusFilter = 'all';
  page = 0;
  pageCount = 1;
  filteredRows: UnitRow[] = [];
  pagedRows: UnitRow[] = [];
  scopeNoOwner = 0;
  scopeNoResident = 0;

  private rows: UnitRow[] = [];
  private ownersByUnit = new Map<string, UnitOwnerAssignment[]>();
  private residentsByUnit = new Map<string, Assignment[]>();

  private get unitOwners(): UnitOwnerAssignment[] {
    return this.selectedUnit ? this.ownersByUnit.get(this.selectedUnit.id) ?? [] : [];
  }

  get currentPrimary(): UnitOwnerAssignment | null {
    return this.unitOwners.find(a => a.isPrimary) ?? null;
  }

  get currentSecondary(): UnitOwnerAssignment | null {
    return this.unitOwners.find(a => !a.isPrimary) ?? null;
  }

  get canAddMore(): boolean {
    return !this.currentPrimary || !this.currentSecondary;
  }

  get availableOwners(): Owner[] {
    const usedIds = new Set(this.unitOwners.map(a => a.ownerId));
    return this.owners.filter(o => !usedIds.has(o.id));
  }

  private get unitResidents(): Assignment[] {
    return this.selectedUnit ? this.residentsByUnit.get(this.selectedUnit.id) ?? [] : [];
  }

  get activeResidents(): Assignment[] {
    return this.unitResidents.filter(a => !a.endDate);
  }

  get endedResidents(): Assignment[] {
    return this.unitResidents.filter(a => !!a.endDate);
  }

  get availableResidents(): Resident[] {
    const activeIds = new Set(this.activeResidents.map(a => a.residentId));
    return this.residents.filter(r => !activeIds.has(r.id));
  }

  trackRow(_: number, row: UnitRow): string {
    return row.unit.id;
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
        this.buildBuildingOptions();
        this.loading = false;
        this.refresh();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar los datos.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private buildBuildingOptions(): void {
    const byId = new Map<string, string>();
    this.units.forEach(u => byId.set(u.buildingId, u.buildingName));
    const list = [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    this.buildingOptions = list.length > 1 ? [{ id: '', name: 'Todos los edificios' }, ...list] : list;

    const saved = this.readSavedBuilding();
    if (list.length === 1) this.buildingId = list[0].id;
    else if (saved && byId.has(saved)) this.buildingId = saved;
  }

  // Reconstruye el índice por unidad y vuelve a aplicar los filtros (se llama al cargar y tras cada alta o baja).
  private refresh(): void {
    this.ownersByUnit = this.groupByUnit(this.assignments);
    this.residentsByUnit = this.groupByUnit(this.residentAssignments);
    this.rows = this.units.map(unit => {
      const owners = this.ownersByUnit.get(unit.id) ?? [];
      const active = (this.residentsByUnit.get(unit.id) ?? []).filter(a => !a.endDate);
      const mainOwner = owners.find(o => o.isPrimary) ?? owners[0];
      const mainResident = active.find(a => a.isPrimary) ?? active[0];
      return {
        unit,
        ownerCount: owners.length,
        ownerSummary: mainOwner ? mainOwner.ownerName + (owners.length > 1 ? ` +${owners.length - 1}` : '') : '',
        residentCount: active.length,
        residentSummary: mainResident ? mainResident.residentName + (active.length > 1 ? ` +${active.length - 1}` : '') : '',
        search: [unit.code, unit.floor, ...owners.map(o => o.ownerName), ...active.map(a => a.residentName)].join(' ').toLowerCase()
      };
    });
    this.applyFilters();
  }

  private groupByUnit<T extends { unitId: string }>(items: T[]): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const list = map.get(item.unitId);
      if (list) list.push(item); else map.set(item.unitId, [item]);
    }
    return map;
  }

  private applyFilters(): void {
    const q = this.search.trim().toLowerCase();
    const inBuilding = this.rows.filter(r => !this.buildingId || r.unit.buildingId === this.buildingId);
    this.scopeNoOwner = inBuilding.filter(r => !r.ownerCount).length;
    this.scopeNoResident = inBuilding.filter(r => !r.residentCount).length;

    this.filteredRows = inBuilding.filter(r => {
      if (q && !r.search.includes(q)) return false;
      switch (this.status) {
        case 'noOwner': return !r.ownerCount;
        case 'noResident': return !r.residentCount;
        case 'complete': return !!r.ownerCount && !!r.residentCount;
        default: return true;
      }
    });
    this.pageCount = Math.max(1, Math.ceil(this.filteredRows.length / PAGE_SIZE));
    this.page = Math.min(this.page, this.pageCount - 1);
    this.pagedRows = this.filteredRows.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    this.page = 0;
    this.selectedUnit = null;
    this.saveBuilding();
    this.applyFilters();
  }

  quickStatus(value: StatusFilter): void {
    this.status = this.status === value ? 'all' : value;
    this.onFilterChange();
  }

  goPage(page: number): void {
    this.page = Math.max(0, Math.min(page, this.pageCount - 1));
    this.selectedUnit = null;
    this.applyFilters();
  }

  toggleUnit(unit: UnitOption): void {
    if (this.selectedUnit?.id === unit.id) {
      this.selectedUnit = null;
    } else {
      this.selectedUnit = unit;
      this.addForm = this.emptyAddForm();
      this.residentAddForm = this.emptyResidentAddForm();
      this.ownersOpen = true;
      this.residentsOpen = true;
      this.showHistory = false;
    }
    this.cdr.markForCheck();
  }

  private readSavedBuilding(): string | null {
    try { return localStorage.getItem(BUILDING_KEY); } catch { return null; }
  }

  private saveBuilding(): void {
    try { localStorage.setItem(BUILDING_KEY, this.buildingId); } catch { /* sin almacenamiento: no se recuerda */ }
  }

  addOwner(): void {
    if (!this.selectedUnit || !this.addForm.ownerId) return;

    const isPrimary = !this.currentPrimary;
    this.isSaving = true;

    this.unitOwnersApi.create({
      unitId: this.selectedUnit.id,
      ownerId: this.addForm.ownerId,
      isPrimary,
      startDate: this.addForm.startDate,
      ownershipPercentage: this.addForm.ownershipPercentage ? Number(this.addForm.ownershipPercentage) : null
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (created) => {
        this.assignments = [...this.assignments, created];
        this.refresh();
        this.addForm = this.emptyAddForm();
        this.isSaving = false;
        const transferred = created.transferredCredit ?? 0;
        this.msg.add({
          severity: 'success', summary: 'Guardado', life: transferred > 0 ? 8000 : 4000,
          detail: transferred > 0
            ? `Propietario asignado. Se le traspasaron ${this.gs(transferred)} de saldo a favor que tenía la unidad.`
            : 'Propietario asignado correctamente.'
        });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo asignar el propietario.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  // Cambia el porcentaje de titularidad de un propietario de la unidad (vacío = sin informar).
  editOwnership(item: UnitOwnerAssignment): void {
    const answer = window.prompt(`Porcentaje de titularidad de ${item.ownerName} en la unidad ${item.unitCode} (0 a 100; vacío para no informar):`, item.ownershipPercentage ? String(item.ownershipPercentage) : '');
    if (answer === null) return;

    const value = answer.trim() === '' ? null : Number(answer.replace(',', '.'));
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El porcentaje debe estar entre 0 y 100.', life: 5000 });
      return;
    }

    this.isSaving = true;
    this.unitOwnersApi.updateOwnership(item.id, value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.assignments = this.assignments.map(a => a.id === updated.id ? { ...a, ownershipPercentage: updated.ownershipPercentage } : a);
        this.refresh();
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Guardado', detail: 'Titularidad actualizada.', life: 3000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo guardar la titularidad.'), life: 6000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  gs(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  // Cambio de propietario: antes de quitar al propietario principal se ve si la unidad tiene deuda (en ese caso no se puede) y qué pasa
  // con el saldo a favor de la unidad, que queda retenido hasta asignar al nuevo propietario principal y pasa a él.
  removeOwner(item: UnitOwnerAssignment): void {
    this.isSaving = true;
    this.unitOwnersApi.removalPreview(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (preview) => {
        if (!preview.canRemove) {
          this.msg.add({ severity: 'error', summary: 'No se puede quitar', detail: preview.message ?? 'La unidad tiene deuda pendiente.', life: 12000 });
          this.isSaving = false;
          this.cdr.markForCheck();
          return;
        }

        let question = '';
        if (preview.creditToHold > 0) {
          question = `La unidad ${preview.unitCode} tiene ${this.gs(preview.creditToHold)} de saldo a favor. Quedará retenido hasta que asignes al nuevo propietario principal, que lo recibirá.\n\n¿Quitar a ${preview.ownerName}?`;
        } else if (preview.creditToTransfer > 0) {
          question = `La unidad ${preview.unitCode} tiene ${this.gs(preview.creditToTransfer)} de saldo a favor. Pasará al otro propietario principal que sigue en la unidad.\n\n¿Quitar a ${preview.ownerName}?`;
        }
        if (question && !confirm(question)) {
          this.isSaving = false;
          this.cdr.markForCheck();
          return;
        }

        // El motivo del cambio queda en el historial de titularidad de la unidad (opcional; cancelar no quita al propietario).
        const reason = window.prompt('Motivo del cambio de propietario (opcional):', '');
        if (reason === null) {
          this.isSaving = false;
          this.cdr.markForCheck();
          return;
        }

        this.doRemoveOwner(item, reason);
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo revisar la baja del propietario.'), life: 6000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  private doRemoveOwner(item: UnitOwnerAssignment, reason: string): void {
    this.unitOwnersApi.delete(item.id, reason).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.assignments = this.assignments.filter(a => a.id !== item.id);
        this.refresh();
        this.isSaving = false;
        let detail = 'Propietario quitado de la unidad.';
        if (result?.heldCredit > 0) {
          detail += ` El saldo a favor de la unidad (${this.gs(result.heldCredit)}) quedó retenido hasta asignar al nuevo propietario principal.`;
        } else if (result?.transferredCredit > 0) {
          detail += ` El saldo a favor de la unidad (${this.gs(result.transferredCredit)}) pasó al otro propietario principal.`;
        }
        this.msg.add({ severity: 'success', summary: 'Quitado', detail, life: result?.heldCredit > 0 || result?.transferredCredit > 0 ? 9000 : 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo quitar el propietario.'), life: 12000 });
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
        this.refresh();
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
        this.refresh();
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
    return { ownerId: null as string | null, startDate: new Date().toISOString().slice(0, 10), ownershipPercentage: null as number | null };
  }

  private emptyResidentAddForm() {
    return { residentId: null as string | null, isPrimary: false, startDate: new Date().toISOString().slice(0, 10) };
  }
}
