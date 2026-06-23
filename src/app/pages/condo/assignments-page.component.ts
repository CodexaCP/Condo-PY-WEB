import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { AssignmentsApiService } from '../../api/assignments-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Resident, Unit, Assignment } from '../../api/models';
import { ResidentsApiService } from '../../api/residents-api.service';
import { UnitsApiService } from '../../api/units-api.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-assignments-page',
  imports: [CommonModule, FormsModule, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Asignaciones</h1>
            <p>Relacion entre unidades y residentes para el modulo 1.</p>
          </div>
        </div>

        <p-button
          *ngIf="!isReadOnly"
          [label]="showForm ? 'Cerrar formulario' : 'Nueva asignacion'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <form class="app-form-grid" *ngIf="showForm" (ngSubmit)="createAssignment()">
        <label>
          <span>Unidad</span>
          <select [(ngModel)]="form.unitId" name="unitId" required>
            <option value="" disabled>Selecciona una unidad</option>
            <option *ngFor="let unit of units" [value]="unit.id">{{ unit.code }} · {{ unit.buildingName }}</option>
          </select>
        </label>

        <label>
          <span>Residente</span>
          <select [(ngModel)]="form.residentId" name="residentId" required>
            <option value="" disabled>Selecciona un residente</option>
            <option *ngFor="let resident of residents" [value]="resident.id">{{ resident.fullName }}</option>
          </select>
        </label>

        <label>
          <span>Fecha de inicio</span>
          <input [(ngModel)]="form.startDate" name="startDate" type="date" required />
        </label>

        <label>
          <span>Fecha de fin</span>
          <input [(ngModel)]="form.endDate" name="endDate" type="date" />
        </label>

        <label class="checkbox">
          <input [(ngModel)]="form.isPrimary" name="isPrimary" type="checkbox" />
          <span>Asignacion principal</span>
        </label>

        <div class="wide form-actions">
          <p-button type="submit" [disabled]="!units.length || !residents.length" [loading]="isSaving" label="Guardar asignacion"></p-button>
        </div>
      </form>

      <p class="app-state" *ngIf="loading">Cargando asignaciones...</p>
      <p class="app-state" *ngIf="!loading && !items.length">No hay asignaciones cargadas.</p>

      <div class="assignment-grid" *ngIf="items.length">
        <article class="assignment-card" *ngFor="let item of items">
          <strong>{{ item.unitCode }}</strong>
          <span>{{ item.residentName }}</span>
          <small>{{ item.isPrimary ? 'Principal' : 'Secundaria' }} · Desde {{ item.startDate }}</small>
          <div class="app-actions" *ngIf="!isReadOnly">
            <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving" (onClick)="deleteAssignment(item)"></p-button>
          </div>
        </article>
      </div>
    </p-card>
  `,
  styles: [`
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .assignment-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:1rem; }
    .assignment-card { background:#f8fbfa; border-radius:20px; padding:1.2rem; display:grid; gap:0.55rem; }
    .assignment-card strong { color:#15373d; }
    .assignment-card span, .assignment-card small { color:#6b878d; }
    @media (max-width: 860px) { .assignment-grid { grid-template-columns: 1fr; } }
  `]
})
export class AssignmentsPageComponent implements OnInit {
  private readonly assignmentsApi = inject(AssignmentsApiService);
  private readonly unitsApi = inject(UnitsApiService);
  private readonly residentsApi = inject(ResidentsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  get isReadOnly(): boolean { return this.auth.hasRole('CompanyAdmin'); }

  items: Assignment[] = [];
  units: Unit[] = [];
  residents: Resident[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  form = this.createInitialForm();

  ngOnInit(): void {
    this.loadData();
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
  }

  createAssignment(): void {
    if (!this.form.unitId) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La unidad es obligatoria.', life: 5000 });
      return;
    }

    if (!this.form.residentId) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El residente es obligatorio.', life: 5000 });
      return;
    }

    if (this.form.endDate && this.form.endDate < this.form.startDate) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La fecha de fin no puede ser anterior a la fecha de inicio.', life: 5000 });
      return;
    }

    this.isSaving = true;

    this.assignmentsApi
      .create({
        unitId: this.form.unitId,
        residentId: this.form.residentId,
        isPrimary: this.form.isPrimary,
        startDate: this.form.startDate,
        endDate: this.form.endDate || null
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (assignment) => {
          this.items = [assignment, ...this.items];
          this.form = this.createInitialForm();
          this.isSaving = false;
          this.showForm = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Asignacion creada correctamente.', life: 4000 });
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo guardar la asignacion.'), life: 5000 });
          this.isSaving = false;
          this.cdr.markForCheck();
        }
      });
  }

  deleteAssignment(item: Assignment): void {
    this.isSaving = true;

    this.assignmentsApi
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items = this.items.filter((current) => current.id !== item.id);
          this.isSaving = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Asignacion eliminada correctamente.', life: 4000 });
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo eliminar la asignacion.'), life: 5000 });
          this.isSaving = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadData(): void {
    this.loading = true;

    forkJoin({
      assignments: this.assignmentsApi.getAll(),
      units: this.unitsApi.getAll(),
      residents: this.residentsApi.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ assignments, units, residents }) => {
          this.items = assignments;
          this.units = units;
          this.residents = residents;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar las asignaciones.'), life: 5000 });
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private createInitialForm() {
    return {
      unitId: '',
      residentId: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      isPrimary: true
    };
  }
}
