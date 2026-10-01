import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinanceBuildingAccess, FinanceSettings } from '../../api/models';
import { FinanceAccountsEditorComponent } from './finance-accounts-editor.component';
import { FinanceBuildingPickerComponent } from './finance-building-picker.component';
import { FinanceChartEditorComponent } from './finance-chart-editor.component';

type Section = 'general' | 'accounts' | 'chart' | 'review';

const STEPS: { key: Section; label: string }[] = [
  { key: 'general', label: 'Fecha de arranque' },
  { key: 'accounts', label: 'Cuentas financieras' },
  { key: 'chart', label: 'Plan de cuentas' },
  { key: 'review', label: 'Revisión' }
];

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Configuración del módulo «Finanzas del edificio». Hasta completar la configuración inicial el módulo muestra solo este
// asistente (fecha de arranque, cuentas con su saldo inicial y plan de cuentas); una vez completa, las mismas secciones
// quedan como pestañas. Operador y Encargado la ven en solo lectura: la modifica el Administrador de empresa.
@Component({
  standalone: true,
  selector: 'app-finance-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag, FinanceAccountsEditorComponent, FinanceChartEditorComponent, FinanceBuildingPickerComponent],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Finanzas del edificio</h1>
            <p>{{ wizard ? 'Configuración inicial: completala para empezar a usar el módulo.' : 'Configuración del módulo.' }}</p>
          </div>
        </div>
        <app-finance-building-picker (selected)="onBuilding($event)" (failed)="onPickerError($event)"></app-finance-building-picker>
      </div>

      <div class="disclaimer">
        <i class="pi pi-info-circle"></i>
        <span>
          Este módulo ordena la información financiera del edificio para consultarla y entregarla al contador.
          <strong>No reemplaza al contador</strong> ni es contabilidad formal.
        </span>
      </div>

      <p class="app-state" *ngIf="loadingBuildings">Cargando...</p>
      <p-message *ngIf="noBuilding && !blockedMessage && !pageError" severity="warn"
                 text="El módulo Finanzas del edificio no está habilitado en ninguno de tus edificios."></p-message>
      <p-message *ngIf="blockedMessage" severity="warn" [text]="blockedMessage"></p-message>
      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loadingSettings">Cargando configuración...</p>

      <ng-container *ngIf="settings as s">
        <div class="basis">
          <p-tag severity="info" [value]="'Caja y saldos: ' + s.cashBasis.toLowerCase() + ' (lo cobrado y pagado)'"></p-tag>
          <p-tag severity="info" [value]="'Cuentas por cobrar y morosidad: ' + s.receivablesBasis.toLowerCase() + ' (lo emitido)'"></p-tag>
        </div>

        <p-message *ngIf="!s.canEdit && !s.setupCompleted" severity="info"
                   text="La configuración inicial todavía no está completa. La realiza el Administrador de empresa; mientras tanto podés ver lo que ya se cargó."></p-message>

        <nav class="steps" *ngIf="wizard" aria-label="Pasos de la configuración">
          <button type="button" *ngFor="let step of steps; let i = index" class="step" [class.active]="section === step.key"
                  [class.done]="isStepDone(step.key)" (click)="goTo(step.key)">
            <span class="num">{{ isStepDone(step.key) && section !== step.key ? '✓' : i + 1 }}</span>
            <span>{{ step.label }}</span>
          </button>
        </nav>
        <nav class="tabs" *ngIf="!wizard" aria-label="Secciones">
          <button type="button" *ngFor="let step of tabs" class="tab" [class.active]="section === step.key" (click)="goTo(step.key)">{{ step.label }}</button>
        </nav>

        <!-- Fecha de arranque -->
        <section class="panel" *ngIf="section === 'general'">
          <h2>Fecha de arranque</h2>
          <p class="lead">
            El módulo solo cuenta los movimientos desde esta fecha, más los saldos iniciales que cargues en cada cuenta.
            No se rellena la historia anterior.
          </p>
          <form class="general-form" (ngSubmit)="saveGeneral(false)">
            <label>
              <span>Fecha de arranque <span class="req">*</span></span>
              <input type="date" [(ngModel)]="startDate" name="startDate" [disabled]="!s.canEdit" required />
            </label>
            <label>
              <span>Mes en que empieza el ejercicio</span>
              <select [(ngModel)]="fiscalMonth" name="fiscalMonth" [disabled]="!s.canEdit">
                <option *ngFor="let m of months; let i = index" [ngValue]="i + 1">{{ m }}</option>
              </select>
            </label>
            <p class="reserve" *ngIf="s.reserveFundPercentage !== null">
              Aporte al fondo de reserva del edificio: <strong>{{ s.reserveFundPercentage }} %</strong> (se modifica en la ficha del edificio).
            </p>
            <div class="form-footer" *ngIf="s.canEdit">
              <p-button type="submit" [loading]="busy" [label]="wizard ? 'Guardar' : 'Guardar cambios'" severity="secondary" [outlined]="wizard"></p-button>
            </div>
          </form>
        </section>

        <section class="panel" *ngIf="section === 'accounts'">
          <h2>Cuentas financieras</h2>
          <app-finance-accounts-editor [buildingId]="buildingId" [canEdit]="s.canEdit" [startDate]="s.financeStartDate" [defaultAccountId]="s.defaultAccountId" (changed)="reloadSettings()"></app-finance-accounts-editor>
        </section>

        <section class="panel" *ngIf="section === 'chart'">
          <h2>Plan de cuentas</h2>
          <app-finance-chart-editor [buildingId]="buildingId" [canEdit]="s.canEdit" (changed)="reloadSettings()"></app-finance-chart-editor>
        </section>

        <!-- Revisión (solo en el asistente) -->
        <section class="panel" *ngIf="section === 'review' && wizard">
          <h2>Revisión</h2>
          <p class="lead">Revisá que esté todo lo necesario y completá la configuración. Después podés seguir editando estos datos cuando haga falta.</p>
          <ul class="checklist">
            <li [class.ok]="!!s.financeStartDate">
              <i class="pi" [ngClass]="s.financeStartDate ? 'pi-check-circle' : 'pi-circle'"></i>
              Fecha de arranque: <strong>{{ s.financeStartDate ? (s.financeStartDate | date: 'dd/MM/yyyy') : 'sin definir' }}</strong>
            </li>
            <li [class.ok]="s.accountCount > 0">
              <i class="pi" [ngClass]="s.accountCount > 0 ? 'pi-check-circle' : 'pi-circle'"></i>
              Cuentas financieras: <strong>{{ s.accountCount }}</strong>
            </li>
            <li [class.ok]="s.categoryCount > 0">
              <i class="pi" [ngClass]="s.categoryCount > 0 ? 'pi-check-circle' : 'pi-circle'"></i>
              Plan de cuentas: <strong>{{ s.categoryCount }} rubros</strong>
            </li>
          </ul>
          <p-message *ngFor="let m of s.missingForSetup" severity="warn" [text]="m"></p-message>
          <div class="form-footer">
            <p-button type="button" label="Completar configuración" icon="pi pi-check" [disabled]="s.missingForSetup.length > 0" [loading]="busy" (onClick)="complete()"></p-button>
          </div>
        </section>

        <div class="wizard-footer" *ngIf="wizard">
          <p-button type="button" label="Anterior" icon="pi pi-arrow-left" severity="secondary" [outlined]="true" [disabled]="stepIndex === 0" (onClick)="back()"></p-button>
          <p-button *ngIf="stepIndex < steps.length - 1" type="button" label="Siguiente" icon="pi pi-arrow-right" iconPos="right" [loading]="busy" (onClick)="next()"></p-button>
        </div>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .general-form input, .general-form select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .disclaimer {
      display: flex; gap: 0.6rem; align-items: flex-start; margin-bottom: 1rem; padding: 0.7rem 1rem;
      border-radius: 12px; background: var(--brand-gradient-soft); color: var(--brand-ink-soft); font-size: 0.9rem; line-height: 1.45;
    }
    .disclaimer i { margin-top: 0.15rem; color: var(--brand-c2); }
    .basis { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }

    .steps, .tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0; }
    .step {
      display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.9rem; border-radius: 999px; cursor: pointer;
      border: 1px solid var(--brand-border); background: transparent; color: var(--brand-ink-soft); font: inherit; font-weight: 600;
    }
    .step .num {
      display: inline-grid; place-items: center; width: 1.5rem; height: 1.5rem; border-radius: 50%;
      background: var(--brand-border); font-size: 0.8rem;
    }
    .step.done .num { background: var(--brand-c3); color: #fff; }
    .step.active { border-color: var(--brand-c2); color: var(--brand-ink); background: var(--brand-gradient-soft); }
    .step.active .num { background: var(--brand-c2); color: #fff; }
    .tab {
      padding: 0.5rem 1rem; border-radius: 10px; cursor: pointer; border: 1px solid transparent; background: transparent;
      color: var(--brand-ink-soft); font: inherit; font-weight: 600;
    }
    .tab.active { background: var(--brand-gradient-soft); border-color: var(--brand-c2); color: var(--brand-ink); }

    .panel { margin-top: 0.5rem; }
    .panel h2 { margin: 0 0 0.5rem; font-size: 1.25rem; color: var(--brand-ink); }
    .lead { margin: 0 0 1rem; max-width: 66ch; color: var(--brand-ink-soft); line-height: 1.5; }
    .general-form { display: grid; gap: 1rem; max-width: 420px; }
    .general-form label > span { display: block; margin-bottom: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .general-form input, .general-form select { width: 100%; }
    .reserve { margin: 0; color: var(--brand-ink-soft); }
    .req { color: var(--red-400, #f87171); }
    .form-footer { display: flex; gap: 0.75rem; margin-top: 0.5rem; }

    .checklist { list-style: none; margin: 0 0 1rem; padding: 0; display: grid; gap: 0.5rem; }
    .checklist li { display: flex; align-items: center; gap: 0.6rem; color: var(--brand-ink-soft); }
    .checklist li.ok i { color: var(--brand-c3); }
    .checklist li:not(.ok) i { color: var(--brand-muted); }
    :host ::ng-deep .checklist + p-message .p-message { margin-bottom: 0.5rem; }

    .wizard-footer { display: flex; justify-content: space-between; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--brand-border); }
  `]
})
export class FinanceSettingsPageComponent {
  private readonly api = inject(FinanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  readonly steps = STEPS;
  readonly tabs = STEPS.filter(x => x.key !== 'review');
  readonly months = MONTHS;

  buildingId = '';
  loadingBuildings = true;
  noBuilding = false;
  loadingSettings = false;
  pageError = '';
  // Mensaje del backend cuando el módulo está apagado o el plan no lo incluye (403 finance_*).
  blockedMessage = '';

  settings: FinanceSettings | null = null;
  section: Section = 'general';
  busy = false;

  startDate = '';
  fiscalMonth = 1;

  // El edificio lo elige el selector compartido (aparece solo con mas de un edificio) y avisa en onBuilding.
  onBuilding(building: FinanceBuildingAccess | null): void {
    this.loadingBuildings = false;
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.buildingId;
    this.loadSettings();
  }

  onPickerError(err: unknown): void {
    this.loadingBuildings = false;
    this.handleLoadError(err, 'No se pudieron cargar los edificios.');
  }

  // Asistente mientras la configuración no esté completa y el usuario pueda editarla.
  get wizard(): boolean { return !!this.settings && !this.settings.setupCompleted && this.settings.canEdit; }
  get stepIndex(): number { return Math.max(0, this.steps.findIndex(x => x.key === this.section)); }

  isStepDone(key: Section): boolean {
    const s = this.settings;
    if (!s) return false;
    switch (key) {
      case 'general': return !!s.financeStartDate;
      case 'accounts': return s.accountCount > 0;
      case 'chart': return s.categoryCount > 0;
      // La revisión es el cierre del asistente: no se marca hecha hasta que se completa la configuración.
      default: return false;
    }
  }

  goTo(section: Section): void { this.section = section; }
  back(): void { this.section = this.steps[Math.max(0, this.stepIndex - 1)].key; }

  // En el primer paso «Siguiente» guarda la fecha antes de avanzar.
  next(): void {
    if (this.section === 'general') {
      this.saveGeneral(true);
    } else {
      this.section = this.steps[Math.min(this.steps.length - 1, this.stepIndex + 1)].key;
    }
  }

  loadSettings(): void {
    this.settings = null;
    this.blockedMessage = '';
    this.pageError = '';
    this.loadingSettings = true;
    this.section = 'general';
    this.api.getSettings(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => {
        this.applySettings(settings, true);
        this.loadingSettings = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.loadingSettings = false;
        this.handleLoadError(err, 'No se pudo cargar la configuración.');
      }
    });
  }

  // Refresca los contadores y lo que falta para completar, sin pisar lo que se esté escribiendo en el formulario.
  reloadSettings(): void {
    this.api.getSettings(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => {
        this.applySettings(settings, false);
        this.cdr.markForCheck();
      }
    });
  }

  saveGeneral(advance: boolean): void {
    if (this.busy) return;
    if (!this.startDate) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La fecha de arranque es obligatoria.', life: 5000 });
      return;
    }

    this.busy = true;
    this.api.updateSettings(this.buildingId, { financeStartDate: this.startDate, fiscalYearStartMonth: this.fiscalMonth })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: settings => {
          this.busy = false;
          this.applySettings(settings, true);
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Fecha de arranque guardada.', life: 3500 });
          if (advance) this.section = 'accounts';
          this.cdr.markForCheck();
        },
        error: err => {
          this.busy = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar la fecha de arranque.'), life: 6000 });
          this.cdr.markForCheck();
        }
      });
  }

  complete(): void {
    if (this.busy) return;
    this.busy = true;
    this.api.completeSetup(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => {
        this.busy = false;
        this.applySettings(settings, true);
        this.section = 'general';
        this.msg.add({ severity: 'success', summary: 'Configuración completa', detail: 'El módulo quedó configurado. Podés seguir ajustando estos datos desde las pestañas.', life: 6000 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.busy = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo completar la configuración.'), life: 6000 });
        this.cdr.markForCheck();
      }
    });
  }

  private applySettings(settings: FinanceSettings, resetForm: boolean): void {
    this.settings = settings;
    if (resetForm) {
      this.startDate = settings.financeStartDate ?? '';
      this.fiscalMonth = settings.fiscalYearStartMonth;
    }
  }

  private handleLoadError(err: unknown, fallback: string): void {
    const body = (err as { status?: number; error?: { error?: string; message?: string } })?.error;
    const code = body?.error;
    if (code === 'finance_module_disabled' || code === 'finance_plan_not_included') {
      this.blockedMessage = body?.message ?? 'El módulo Finanzas del edificio no está disponible para este edificio.';
    } else {
      this.pageError = extractApiErrorMessage(err, fallback);
    }
    this.cdr.markForCheck();
  }
}
