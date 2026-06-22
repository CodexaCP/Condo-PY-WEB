import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { Building, Unit } from '../../api/models';
import { UnitsApiService } from '../../api/units-api.service';

@Component({
  standalone: true,
  selector: 'app-units-page',
  imports: [CommonModule, FormsModule, Button, Card, Message],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Unidades</h1>
            <p>Unidades por edificio, con piso y coeficiente para el modulo 1.</p>
          </div>
        </div>

        <p-button
          [label]="showForm ? 'Cerrar formulario' : 'Nueva unidad'"
          [icon]="showForm ? 'pi pi-times' : 'pi pi-plus'"
          (onClick)="toggleForm()">
        </p-button>
      </div>

      <form class="app-form-grid" *ngIf="showForm" (ngSubmit)="submitUnit()">
        <label class="wide">
          <span>Edificio</span>
          <select [(ngModel)]="form.buildingId" name="buildingId" required>
            <option value="" disabled>Selecciona un edificio</option>
            <option *ngFor="let building of buildings" [value]="building.id">{{ building.name }}</option>
          </select>
        </label>

        <label>
          <span>Codigo</span>
          <input
            [(ngModel)]="form.code"
            name="code"
            type="text"
            required
            maxlength="40"
            pattern="^[A-Z0-9]+(?:-[A-Z0-9]+)*$" />
          <small>Usa solo letras, numeros y guiones medios.</small>
        </label>

        <label>
          <span>Piso</span>
          <input [(ngModel)]="form.floor" name="floor" type="text" required />
        </label>

        <label>
          <span>Coeficiente</span>
          <input [(ngModel)]="form.coefficient" name="coefficient" type="number" min="0" step="0.000001" required />
        </label>

        <label class="checkbox">
          <input [(ngModel)]="form.isActive" name="isActive" type="checkbox" />
          <span>Unidad activa</span>
        </label>

        <div class="wide form-actions">
          <p-button type="submit" [disabled]="!buildings.length" [loading]="isSaving" [label]="editingId ? 'Guardar cambios' : 'Guardar unidad'"></p-button>
          <p-button
            *ngIf="editingId"
            type="button"
            label="Cancelar"
            icon="pi pi-times"
            severity="secondary"
            [text]="true"
            (onClick)="cancelEdit()">
          </p-button>
        </div>
      </form>

      <p-message *ngIf="errorMessage" severity="error" [text]="errorMessage"></p-message>
      <p-message *ngIf="successMessage" severity="success" [text]="successMessage"></p-message>
      <p class="app-state" *ngIf="loading">Cargando unidades...</p>
      <p class="app-state" *ngIf="!loading && !errorMessage && !items.length">No hay unidades cargadas.</p>

      <div class="unit-grid" *ngIf="items.length">
        <article class="unit-card" *ngFor="let item of items">
          <strong>{{ item.code }}</strong>
          <span>{{ item.buildingName }}</span>
          <small>Piso {{ item.floor }} · Coef. {{ item.coefficient | number: '1.2-6' }}</small>
          <div class="app-actions">
            <p-button type="button" icon="pi pi-pencil" severity="secondary" [rounded]="true" [text]="true" (onClick)="startEdit(item)"></p-button>
            <p-button type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true" [disabled]="isSaving" (onClick)="deleteUnit(item)"></p-button>
          </div>
        </article>
      </div>
    </p-card>
  `,
  styles: [`
    .form-actions { display:flex; gap:0.75rem; justify-content:flex-end; }
    .unit-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
    .unit-card { background:#f8fbfa; border-radius:20px; padding:1.2rem; display:grid; gap:0.55rem; }
    .unit-card strong { color:#15373d; font-size:1.1rem; }
    .unit-card span, .unit-card small { color:#6b878d; }
    @media (max-width: 860px) { .unit-grid { grid-template-columns: 1fr; } }
  `]
})
export class UnitsPageComponent implements OnInit {
  private readonly unitsApi = inject(UnitsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  items: Unit[] = [];
  buildings: Building[] = [];
  loading = true;
  isSaving = false;
  showForm = false;
  editingId: string | null = null;
  errorMessage = '';
  successMessage = '';
  form = this.createInitialForm();

  ngOnInit(): void {
    this.loadData();
  }

  toggleForm(): void {
    if (this.showForm && this.editingId) {
      this.cancelEdit();
      return;
    }

    this.showForm = !this.showForm;
    this.errorMessage = '';
    this.successMessage = '';
    if (!this.showForm) {
      this.form = this.createInitialForm();
    }
  }

  startEdit(item: Unit): void {
    this.editingId = item.id;
    this.showForm = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.form = {
      buildingId: item.buildingId,
      code: item.code,
      floor: item.floor,
      coefficient: item.coefficient,
      isActive: item.isActive
    };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.showForm = false;
    this.form = this.createInitialForm();
    this.errorMessage = '';
  }

  submitUnit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.form.buildingId) {
      this.errorMessage = 'No se puede crear una unidad sin seleccionar un edificio.';
      return;
    }

    if (!this.form.code.trim()) {
      this.errorMessage = 'El codigo de la unidad es obligatorio.';
      return;
    }

    if (!this.form.floor.trim()) {
      this.errorMessage = 'El piso de la unidad es obligatorio.';
      return;
    }

    const normalizedCode = this.form.code.trim().toUpperCase();
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(normalizedCode)) {
      this.errorMessage = 'El codigo de la unidad solo puede contener letras, numeros y guiones medios.';
      return;
    }

    this.isSaving = true;

    const request = {
      buildingId: this.form.buildingId,
      code: normalizedCode,
      floor: this.form.floor.trim(),
      coefficient: Number(this.form.coefficient),
      isActive: this.form.isActive
    };

    const operation = this.editingId
      ? this.unitsApi.update(this.editingId, request)
      : this.unitsApi.create(request);

    operation
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (unit) => {
          this.items = this.editingId
            ? this.items.map((item) => item.id === unit.id ? unit : item).sort((a, b) => a.code.localeCompare(b.code))
            : [...this.items, unit].sort((a, b) => a.code.localeCompare(b.code));
          this.form = this.createInitialForm();
          this.isSaving = false;
          this.showForm = false;
          this.successMessage = this.editingId ? 'Unidad actualizada correctamente.' : 'Unidad creada correctamente.';
          this.editingId = null;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(
            error,
            this.editingId ? 'No se pudo actualizar la unidad.' : 'No se pudo guardar la unidad.');
          this.isSaving = false;
          this.cdr.markForCheck();
        }
      });
  }

  deleteUnit(item: Unit): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isSaving = true;

    this.unitsApi
      .delete(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items = this.items.filter((current) => current.id !== item.id);
          if (this.editingId === item.id) {
            this.cancelEdit();
          }
          this.isSaving = false;
          this.successMessage = 'Unidad eliminada correctamente.';
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo eliminar la unidad.');
          this.isSaving = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadData(): void {
    forkJoin({
      units: this.unitsApi.getAll(),
      buildings: this.buildingsApi.getAll()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ units, buildings }) => {
          this.items = units;
          this.buildings = buildings;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.errorMessage = extractApiErrorMessage(error, 'No se pudo cargar el listado de unidades.');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private createInitialForm() {
    return {
      buildingId: '',
      code: '',
      floor: '',
      coefficient: 0,
      isActive: true
    };
  }
}
