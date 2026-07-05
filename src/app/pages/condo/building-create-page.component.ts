import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { CondominiumsApiService } from '../../api/condominiums-api.service';
import { Company, Condominium, LateFeeFrequency } from '../../api/models';
import { AuthService } from '../../auth/auth.service';

interface PhonePrefix { label: string; value: string; flag: string; pattern: RegExp; hint: string; }

const PHONE_PREFIXES: PhonePrefix[] = [
  { label: 'PY +595', value: '+595', flag: '🇵🇾', pattern: /^\d{7,9}$/,   hint: '7-9 dígitos' },
  { label: 'USA +1',  value: '+1',   flag: '🇺🇸', pattern: /^\d{10}$/,    hint: '10 dígitos' },
  { label: 'BR +55',  value: '+55',  flag: '🇧🇷', pattern: /^\d{10,11}$/, hint: '10-11 dígitos' },
  { label: 'ARG +54', value: '+54',  flag: '🇦🇷', pattern: /^\d{10}$/,    hint: '10 dígitos' },
];

@Component({
  standalone: true,
  selector: 'app-building-create-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Select, Textarea, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="create-header">
        <button class="back-btn" (click)="cancel()" pTooltip="Volver al listado" tooltipPosition="right">
          <i class="pi pi-arrow-left"></i>
        </button>
        <div>
          <h1>{{ isEditing ? 'Editar edificio' : 'Nuevo edificio' }}</h1>
          <p>{{ isEditing ? editingName : 'Complete los datos para registrar un nuevo edificio.' }}</p>
        </div>
      </div>

      <p-message *ngIf="loadError" severity="error" [text]="loadError"></p-message>
      <div *ngIf="loading" class="app-state">Cargando datos...</div>

      <form class="create-form" (ngSubmit)="save()" *ngIf="!loading && !loadError">

        <section class="form-section">
          <h2 class="section-title">Asignación</h2>

          <!-- Empresa: selector (create, SuperAdmin) | badge read-only (edit, SuperAdmin) -->
          <div class="field" *ngIf="isSuperAdmin && !isEditing">
            <label for="company">Empresa <span class="required">*</span></label>
            <p-select id="company" [options]="companyOptions" [(ngModel)]="form.companyId" name="companyId"
                      optionLabel="label" optionValue="value" placeholder="Seleccionar empresa..."
                      styleClass="full-select" (onChange)="onCompanyChange()">
            </p-select>
          </div>
          <div class="field" *ngIf="isSuperAdmin && isEditing && editingCompanyName">
            <label>Empresa</label>
            <div class="readonly-badge">{{ editingCompanyName }}</div>
            <small class="field-hint">La empresa no puede cambiarse tras la creación.</small>
          </div>

          <!-- Condominio bloqueado: admin asignado a un condominio específico -->
          <div class="field" *ngIf="condominiumLocked">
            <label>Condominio</label>
            <div class="readonly-badge">{{ lockedCondominiumName }}</div>
            <small class="field-hint">Tu cuenta está asignada a este condominio.</small>
          </div>

          <!-- Condominio: selector (SA o admin de empresa sin condominio fijo) -->
          <div class="field" *ngIf="!condominiumLocked">
            <label for="condominium">Condominio <span class="optional">(opcional)</span></label>
            <p-select id="condominium" [options]="filteredCondominiumOptions" [(ngModel)]="form.condominiumId"
                      name="condominiumId" optionLabel="label" optionValue="value"
                      placeholder="Sin condominio" [showClear]="true" styleClass="full-select"
                      [disabled]="isSuperAdmin && !isEditing && !form.companyId">
            </p-select>
            <small class="field-hint" *ngIf="isSuperAdmin && !isEditing && !form.companyId">
              Seleccione primero una empresa para ver sus condominios.
            </small>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Información básica</h2>
          <div class="field-row">
            <div class="field">
              <label for="name">Nombre</label>
              <input id="name" type="text" [(ngModel)]="form.name" name="name"
                     placeholder="Nombre del edificio" maxlength="120" autocomplete="off" />
            </div>
            <div class="field">
              <label for="code">Código</label>
              <input id="code" type="text" [(ngModel)]="form.code" name="code"
                     placeholder="EDI-001" maxlength="40" autocomplete="off" (input)="onCodeInput()" />
              <small class="field-hint">Solo letras mayúsculas, números y guiones medios.</small>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Teléfono de contacto</label>
              <div class="phone-row">
                <p-select [options]="prefixOptions" [(ngModel)]="form.phonePrefix" name="phonePrefix"
                          optionLabel="label" optionValue="value" placeholder="País" styleClass="phone-prefix-select">
                  <ng-template pTemplate="selectedItem" let-item>
                    <span *ngIf="item">{{ item.flag }} {{ item.value }}</span>
                  </ng-template>
                  <ng-template pTemplate="item" let-item>
                    <span>{{ item.flag }} {{ item.label }}</span>
                  </ng-template>
                </p-select>
                <input type="tel" [(ngModel)]="form.phoneNumber" name="phoneNumber"
                       placeholder="Número de teléfono" class="phone-input"
                       (input)="onPhoneInput()" maxlength="15" />
              </div>
              <small class="field-hint" *ngIf="selectedPrefix">Formato esperado: {{ selectedPrefix.hint }}</small>
              <small class="field-error" *ngIf="phoneError">{{ phoneError }}</small>
            </div>
            <div class="field">
              <label for="email">Correo electrónico principal</label>
              <input id="email" type="email" [(ngModel)]="form.email" name="email"
                     placeholder="edificio@gmail.com" maxlength="200" autocomplete="off"
                     (input)="onEmailInput()" />
              <small class="field-error" *ngIf="emailError">{{ emailError }}</small>
            </div>
          </div>
          <div class="field">
            <label for="address">Dirección</label>
            <input id="address" type="text" [(ngModel)]="form.address" name="address"
                   placeholder="Dirección del edificio" maxlength="200" autocomplete="off" />
          </div>
          <div class="field">
            <label for="description">Descripción</label>
            <textarea pTextarea id="description" [(ngModel)]="form.description" name="description"
                      placeholder="Descripción del edificio" rows="3" maxlength="500"></textarea>
          </div>
          <div class="field checkbox-field" *ngIf="isEditing">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
              <span>Edificio activo</span>
            </label>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Interés por mora</h2>
          <div class="field-row">
            <div class="field">
              <label for="lateFeeRate">Tasa de interés por mora (%) <span class="optional">(opcional)</span></label>
              <input id="lateFeeRate" type="number" [(ngModel)]="form.lateFeeRatePercentage" name="lateFeeRatePercentage"
                     placeholder="Ej: 2" min="0" max="100" step="0.01" />
              <small class="field-hint">Interés simple sobre la expensa original vencida. Vacío = sin mora.</small>
            </div>
            <div class="field">
              <label for="lateFeeFrequency">Incremento</label>
              <p-select id="lateFeeFrequency" [options]="lateFeeFrequencyOptions" [(ngModel)]="form.lateFeeFrequency"
                        name="lateFeeFrequency" optionLabel="label" optionValue="value"
                        placeholder="Seleccionar..." styleClass="full-select"
                        [disabled]="!form.lateFeeRatePercentage">
              </p-select>
              <small class="field-hint">Cada intervalo suma la tasa sobre el monto original adeudado. Al cambiar esta configuración se notifica a todos los miembros del edificio.</small>
            </div>
          </div>
        </section>

        <section class="form-actions">
          <p-button type="button" label="Cancelar" [text]="true" [rounded]="true" severity="secondary"
                    (onClick)="cancel()" pTooltip="Cancelar y volver al listado" tooltipPosition="top">
          </p-button>
          <p-button type="submit" [label]="isEditing ? 'Guardar cambios' : 'Guardar edificio'"
                    [text]="true" [rounded]="true" [loading]="isSaving"
                    [pTooltip]="isEditing ? 'Guardar cambios' : 'Guardar nuevo edificio'" tooltipPosition="top">
          </p-button>
        </section>
      </form>
    </p-card>
  `,
  styles: [`
    .create-header { display:flex; align-items:flex-start; gap:1rem; margin-bottom:2rem; }
    .create-header h1 { margin:0 0 0.25rem; }
    .create-header p  { margin:0; color:var(--brand-muted); }
    .back-btn { background:none; border:1px solid rgba(19,133,182,0.2); border-radius:50%; width:40px; height:40px;
      display:grid; place-items:center; cursor:pointer; color:var(--brand-muted);
      transition:background 0.15s,color 0.15s; flex-shrink:0; margin-top:4px; }
    .back-btn:hover { background:rgba(19,133,182,0.08); color:var(--brand-blue); }
    .create-form { display:flex; flex-direction:column; gap:2rem; }
    .form-section { display:flex; flex-direction:column; gap:1.25rem; }
    .field-row { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }
    .section-title { font-size:0.9rem; font-weight:600; text-transform:uppercase; letter-spacing:0.06em;
      color:var(--brand-muted); margin:0 0 0.25rem; padding-bottom:0.5rem; border-bottom:1px solid rgba(19,133,182,0.1); }
    .field { display:flex; flex-direction:column; gap:0.4rem; }
    .field label { font-weight:500; font-size:0.92rem; color:var(--brand-ink); }
    .required { color:#e74c3c; font-weight:600; }
    .optional { font-weight:400; font-size:0.82rem; color:var(--brand-muted); }
    .field input, .field textarea { width:100%; padding:0.6rem 0.85rem; border:1px solid rgba(19,133,182,0.25);
      border-radius:10px; font:inherit; font-size:0.95rem; color:var(--brand-ink); background:#fff;
      transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box; }
    .field input:focus, .field textarea:focus { outline:none; border-color:var(--brand-blue); box-shadow:0 0 0 3px rgba(19,133,182,0.12); }
    .field textarea { resize:vertical; min-height:80px; }
    .checkbox-field .checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:500; }
    .checkbox-field input[type=checkbox] { width:16px; height:16px; cursor:pointer; }
    .readonly-badge { padding:0.5rem 0.85rem; background:rgba(19,133,182,0.06); border:1px solid rgba(19,133,182,0.15);
      border-radius:10px; font-weight:600; color:var(--brand-blue); font-size:0.95rem; }
    .field-hint  { color:var(--brand-muted); font-size:0.8rem; }
    .field-error { color:#e74c3c; font-size:0.82rem; }
    .phone-row { display:flex; gap:0.6rem; align-items:stretch; }
    .phone-input { flex:1; }
    :host ::ng-deep .phone-prefix-select { width:140px; flex-shrink:0; }
    :host ::ng-deep .phone-prefix-select .p-select,
    :host ::ng-deep .full-select .p-select { border-radius:10px; border:1px solid rgba(19,133,182,0.25); }
    :host ::ng-deep .full-select { width:100%; }
    .form-actions { display:flex; justify-content:flex-end; gap:0.75rem; padding-top:0.5rem; border-top:1px solid rgba(19,133,182,0.08); }
  `]
})
export class BuildingCreatePageComponent implements OnInit {
  private readonly api             = inject(BuildingsApiService);
  private readonly companiesApi    = inject(CompaniesApiService);
  private readonly condominiumsApi = inject(CondominiumsApiService);
  private readonly auth            = inject(AuthService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly destroyRef      = inject(DestroyRef);
  private readonly cdr             = inject(ChangeDetectorRef);
  private readonly msg             = inject(MessageService);

  prefixOptions = PHONE_PREFIXES;
  companyOptions: { label: string; value: string }[] = [];
  allCondominiums: Condominium[] = [];
  filteredCondominiumOptions: { label: string; value: string }[] = [];

  isEditing = false;
  editingId = '';
  editingName = '';
  editingCompanyName = '';
  loading   = false;
  loadError = '';
  isSaving  = false;
  phoneError = '';
  emailError = '';

  form = { companyId:'', condominiumId:'', name:'', code:'', address:'', description:'', phonePrefix:'+595', phoneNumber:'', email:'', isActive:true,
           lateFeeRatePercentage: null as number | null, lateFeeFrequency: '' as '' | LateFeeFrequency };

  readonly lateFeeFrequencyOptions = [
    { label: 'Diario', value: 'Daily' },
    { label: 'Semanal', value: 'Weekly' },
    { label: 'Quincenal', value: 'Biweekly' }
  ];

  get isSuperAdmin()       { return this.auth.hasRole('SuperAdmin'); }
  get isCompanyAdmin()     { return this.auth.hasRole('CompanyAdmin'); }
  get condominiumLocked()  { return this.isCompanyAdmin && !!this.auth.currentUser()?.condominiumId; }
  get lockedCondominiumName() {
    const condId = this.auth.currentUser()?.condominiumId;
    return condId ? (this.allCondominiums.find(c => c.id === condId)?.name ?? condId) : '';
  }
  get selectedPrefix() { return PHONE_PREFIXES.find(p => p.value === this.form.phonePrefix); }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    forkJoin({
      companies:    this.isSuperAdmin ? this.companiesApi.getAll() : of([] as Company[]),
      condominiums: this.condominiumsApi.getAll(),
      entity:       id ? this.api.getById(id) : of(null)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ companies, condominiums, entity }) => {
        this.companyOptions = companies.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ label: c.name, value: c.id }));
        this.allCondominiums = condominiums;

        if (id && entity) {
          this.isEditing = true;
          this.editingId = id;
          this.editingName = entity.name;
          this.editingCompanyName = companies.find(c => c.id === entity.companyId)?.name ?? '';
          this.form = {
            companyId:    entity.companyId ?? '',
            condominiumId: entity.condominiumId ?? '',
            name: entity.name, code: entity.code, address: entity.address,
            description: entity.description ?? '',
            phonePrefix: entity.contactPhonePrefix ?? '+595',
            phoneNumber: entity.contactPhone ?? '',
            email: entity.contactEmail ?? '',
            isActive: entity.isActive,
            lateFeeRatePercentage: entity.lateFeeRatePercentage ?? null,
            lateFeeFrequency: entity.lateFeeFrequency ?? ''
          };
        }
        this.refreshCondominiumOptions();

        // Pre-fijar condominio para admin asignado a un condominio específico
        if (!id && this.condominiumLocked) {
          this.form.condominiumId = this.auth.currentUser()?.condominiumId ?? '';
        }

        this.loading = false; this.cdr.markForCheck();
      },
      error: () => { this.loadError = 'No se pudieron cargar los datos.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }

  onCompanyChange(): void {
    this.form.condominiumId = '';
    this.refreshCondominiumOptions();
  }

  private refreshCondominiumOptions(): void {
    let list = this.allCondominiums;
    if (this.isSuperAdmin && this.form.companyId) {
      list = list.filter(c => c.companyId === this.form.companyId);
    }
    this.filteredCondominiumOptions = list.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ label: c.name, value: c.id }));
  }

  onCodeInput()  { this.form.code = this.form.code.toUpperCase().replace(/[^A-Z0-9-]/g, ''); }
  onPhoneInput() { this.form.phoneNumber = this.form.phoneNumber.replace(/\D/g, ''); this.phoneError = ''; }
  onEmailInput() { this.emailError = ''; }
  cancel()       { this.router.navigate(['/buildings']); }

  save(): void {
    this.phoneError = ''; this.emailError = '';
    const companyId     = this.form.companyId || null;
    const condominiumId = this.form.condominiumId || null;
    const name          = this.form.name.trim();
    const code          = this.form.code.trim().toUpperCase();
    const address       = this.form.address.trim();
    const description   = this.form.description.trim() || null;
    const phonePrefix   = this.form.phonePrefix || null;
    const phoneNumber   = this.form.phoneNumber.trim() || null;
    const email         = this.form.email.trim().toLowerCase() || null;

    if (this.isSuperAdmin && !this.isEditing && !companyId) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'La empresa es obligatoria.', life: 5000 }); return; }
    if (!name)    { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre es obligatorio.', life: 5000 }); return; }
    if (!code)    { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El código es obligatorio.', life: 5000 }); return; }
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Código inválido: solo letras mayúsculas, números y guiones.', life: 5000 }); return; }
    if (!address) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'La dirección es obligatoria.', life: 5000 }); return; }
    if (phoneNumber) {
      const p = PHONE_PREFIXES.find(x => x.value === phonePrefix);
      if (p && !p.pattern.test(phoneNumber)) { this.phoneError = `Formato inválido para ${p.label}: ${p.hint}.`; return; }
    }
    if (email && !/^[^\s@]+@gmail\.com$/i.test(email)) { this.emailError = 'Por ahora solo se aceptan correos @gmail.com.'; return; }

    const lateFeeRate = this.form.lateFeeRatePercentage || null;
    const lateFeeFrequency = (lateFeeRate && this.form.lateFeeFrequency) ? this.form.lateFeeFrequency : null;
    if (lateFeeRate && !lateFeeFrequency) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Definí el incremento de la mora (diario, semanal o quincenal).', life: 5000 }); return; }

    const req = { companyId, condominiumId, name, code, address, isActive: this.form.isActive, description, contactPhonePrefix: phonePrefix, contactPhone: phoneNumber, contactEmail: email,
                  lateFeeRatePercentage: lateFeeRate, lateFeeFrequency };
    this.isSaving = true;
    const op = this.isEditing ? this.api.update(this.editingId, req) : this.api.create(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.isSaving = false; this.router.navigate(['/buildings']); },
      error: err => { this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar.'), life: 5000 }); this.isSaving = false; this.cdr.markForCheck(); }
    });
  }
}
