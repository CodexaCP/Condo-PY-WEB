import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { CompaniesApiService } from '../../api/companies-api.service';
import { CondominiumsApiService } from '../../api/condominiums-api.service';
import { Company } from '../../api/models';
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
  selector: 'app-condominium-create-page',
  imports: [CommonModule, FormsModule, Button, Card, Select, Textarea, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="create-header">
        <button class="back-btn" (click)="cancel()" pTooltip="Volver al listado" tooltipPosition="right">
          <i class="pi pi-arrow-left"></i>
        </button>
        <div>
          <h1>{{ isEditing ? 'Editar condominio' : 'Nuevo condominio' }}</h1>
          <p>{{ isEditing ? editingName : 'Complete los datos para registrar un nuevo condominio.' }}</p>
        </div>
      </div>

      <p-message *ngIf="loadError" severity="error" [text]="loadError"></p-message>
      <div *ngIf="loading" class="app-state">Cargando datos...</div>

      <form class="create-form" (ngSubmit)="save()" *ngIf="!loading && !loadError">

        <!-- Empresa: selector en create (SuperAdmin), read-only badge en edit -->
        <section class="form-section" *ngIf="isSuperAdmin">
          <h2 class="section-title">Empresa</h2>
          <div class="field" *ngIf="!isEditing">
            <label for="company">Empresa <span class="optional">(opcional)</span></label>
            <p-select id="company" [options]="companyOptions" [(ngModel)]="form.companyId" name="companyId"
                      optionLabel="label" optionValue="value" placeholder="Seleccionar empresa..."
                      [showClear]="true" styleClass="full-select">
            </p-select>
          </div>
          <div class="field" *ngIf="isEditing && editingCompanyName">
            <label>Empresa</label>
            <div class="readonly-badge">{{ editingCompanyName }}</div>
            <small class="field-hint">La empresa no puede cambiarse tras la creación.</small>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Información básica</h2>
          <div class="field-row">
            <div class="field">
              <label for="name">Nombre</label>
              <input id="name" type="text" [(ngModel)]="form.name" name="name"
                     placeholder="Nombre del condominio" maxlength="120" autocomplete="off" />
            </div>
            <div class="field">
              <label for="code">Código</label>
              <input id="code" type="text" [(ngModel)]="form.code" name="code"
                     placeholder="COD-001" maxlength="40" autocomplete="off" (input)="onCodeInput()" />
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
                     placeholder="condominio@gmail.com" maxlength="200" autocomplete="off"
                     (input)="onEmailInput()" />
              <small class="field-error" *ngIf="emailError">{{ emailError }}</small>
            </div>
          </div>
          <div class="field">
            <label for="address">Dirección</label>
            <input id="address" type="text" [(ngModel)]="form.address" name="address"
                   placeholder="Dirección del condominio" maxlength="200" autocomplete="off" />
          </div>
          <div class="field">
            <label for="description">Descripción</label>
            <textarea pTextarea id="description" [(ngModel)]="form.description" name="description"
                      placeholder="Descripción del condominio" rows="3" maxlength="500"></textarea>
          </div>
          <div class="field checkbox-field" *ngIf="isEditing">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
              <span>Condominio activo</span>
            </label>
          </div>
        </section>

        <section class="form-actions">
          <p-button type="button" label="Cancelar" [text]="true" [rounded]="true" severity="secondary"
                    (onClick)="cancel()" pTooltip="Cancelar y volver al listado" tooltipPosition="top">
          </p-button>
          <p-button type="submit" [label]="isEditing ? 'Guardar cambios' : 'Guardar condominio'"
                    [text]="true" [rounded]="true" [loading]="isSaving"
                    [pTooltip]="isEditing ? 'Guardar cambios' : 'Guardar nuevo condominio'" tooltipPosition="top">
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
export class CondominiumCreatePageComponent implements OnInit {
  private readonly api         = inject(CondominiumsApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly auth        = inject(AuthService);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly destroyRef  = inject(DestroyRef);
  private readonly cdr         = inject(ChangeDetectorRef);
  private readonly msg         = inject(MessageService);

  prefixOptions = PHONE_PREFIXES;
  companyOptions: { label: string; value: string }[] = [];
  isEditing = false;
  editingId = '';
  editingName = '';
  editingCompanyName = '';
  loading   = false;
  loadError = '';
  isSaving  = false;
  phoneError = '';
  emailError = '';

  form = { companyId:'', name:'', code:'', address:'', description:'', phonePrefix:'+595', phoneNumber:'', email:'', isActive:true };

  get isSuperAdmin() { return this.auth.hasRole('SuperAdmin'); }
  get selectedPrefix() { return PHONE_PREFIXES.find(p => p.value === this.form.phonePrefix); }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    forkJoin({
      companies: this.isSuperAdmin ? this.companiesApi.getAll() : of([] as Company[]),
      entity: id ? this.api.getById(id) : of(null)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ companies, entity }) => {
        this.companyOptions = companies.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ label: c.name, value: c.id }));

        if (id && entity) {
          this.isEditing = true;
          this.editingId = id;
          this.editingName = entity.name;
          this.editingCompanyName = companies.find(c => c.id === entity.companyId)?.name ?? '';
          this.form = {
            companyId: entity.companyId ?? '',
            name: entity.name, code: entity.code, address: entity.address,
            description: entity.description ?? '',
            phonePrefix: entity.contactPhonePrefix ?? '+595',
            phoneNumber: entity.contactPhone ?? '',
            email: entity.contactEmail ?? '',
            isActive: entity.isActive
          };
        }
        this.loading = false; this.cdr.markForCheck();
      },
      error: () => { this.loadError = 'No se pudieron cargar los datos.'; this.loading = false; this.cdr.markForCheck(); }
    });
  }

  onCodeInput()  { this.form.code = this.form.code.toUpperCase().replace(/[^A-Z0-9-]/g, ''); }
  onPhoneInput() { this.form.phoneNumber = this.form.phoneNumber.replace(/\D/g, ''); this.phoneError = ''; }
  onEmailInput() { this.emailError = ''; }
  cancel()       { this.router.navigate(['/condominiums']); }

  save(): void {
    this.phoneError = ''; this.emailError = '';
    const companyId   = this.form.companyId || null;
    const name        = this.form.name.trim();
    const code        = this.form.code.trim().toUpperCase();
    const address     = this.form.address.trim();
    const description = this.form.description.trim() || null;
    const phonePrefix = this.form.phonePrefix || null;
    const phoneNumber = this.form.phoneNumber.trim() || null;
    const email       = this.form.email.trim().toLowerCase() || null;

    if (!name)    { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre es obligatorio.', life: 5000 }); return; }
    if (!code)    { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El código es obligatorio.', life: 5000 }); return; }
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Código inválido: solo letras mayúsculas, números y guiones.', life: 5000 }); return; }
    if (!address) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'La dirección es obligatoria.', life: 5000 }); return; }
    if (phoneNumber) {
      const p = PHONE_PREFIXES.find(x => x.value === phonePrefix);
      if (p && !p.pattern.test(phoneNumber)) { this.phoneError = `Formato inválido para ${p.label}: ${p.hint}.`; return; }
    }
    if (email && !/^[^\s@]+@gmail\.com$/i.test(email)) { this.emailError = 'Por ahora solo se aceptan correos @gmail.com.'; return; }

    const req = { companyId, name, code, address, isActive: this.form.isActive, description, contactPhonePrefix: phonePrefix, contactPhone: phoneNumber, contactEmail: email };
    this.isSaving = true;
    const op = this.isEditing ? this.api.update(this.editingId, req) : this.api.create(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.isSaving = false; this.router.navigate(['/condominiums']); },
      error: err => { this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar.'), life: 5000 }); this.isSaving = false; this.cdr.markForCheck(); }
    });
  }
}
