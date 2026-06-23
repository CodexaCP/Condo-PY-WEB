import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { CompaniesApiService } from '../../api/companies-api.service';

interface PhonePrefix { label: string; value: string; flag: string; pattern: RegExp; hint: string; }

const PHONE_PREFIXES: PhonePrefix[] = [
  { label: 'PY +595', value: '+595', flag: '🇵🇾', pattern: /^\d{7,9}$/,   hint: '7-9 dígitos' },
  { label: 'USA +1',  value: '+1',   flag: '🇺🇸', pattern: /^\d{10}$/,    hint: '10 dígitos' },
  { label: 'BR +55',  value: '+55',  flag: '🇧🇷', pattern: /^\d{10,11}$/, hint: '10-11 dígitos' },
  { label: 'ARG +54', value: '+54',  flag: '🇦🇷', pattern: /^\d{10}$/,    hint: '10 dígitos' },
];

@Component({
  standalone: true,
  selector: 'app-company-create-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Select, Textarea, Tooltip],
  template: `
    <p-card styleClass="app-page-card">
      <div class="create-header">
        <button class="back-btn" (click)="cancel()" pTooltip="Volver al listado" tooltipPosition="right">
          <i class="pi pi-arrow-left"></i>
        </button>
        <div>
          <h1>{{ isEditing ? 'Editar empresa' : 'Nueva empresa' }}</h1>
          <p>{{ isEditing ? editingName : 'Complete los datos para registrar una nueva empresa administradora.' }}</p>
        </div>
      </div>

      <p-message *ngIf="loadError" severity="error" [text]="loadError"></p-message>

      <div *ngIf="loading" class="app-state">Cargando datos...</div>

      <form class="create-form" (ngSubmit)="save()" *ngIf="!loading && !loadError">

        <section class="form-section">
          <h2 class="section-title">Información básica</h2>
          <div class="field">
            <label for="name">Nombre</label>
            <input id="name" type="text" [(ngModel)]="form.name" name="name"
                   placeholder="Nombre de la compañía" maxlength="120" autocomplete="off" />
          </div>
          <div class="field">
            <label for="slug">Slug</label>
            <input id="slug" type="text" [(ngModel)]="form.slug" name="slug"
                   placeholder="example-slug" maxlength="120" autocomplete="off"
                   (input)="onSlugInput()" />
            <small class="field-hint">Solo minúsculas, números y guiones medios.</small>
          </div>
          <div class="field">
            <label for="description">Descripción</label>
            <textarea pTextarea id="description" [(ngModel)]="form.description" name="description"
                      placeholder="Descripción de la compañía" rows="3" maxlength="500"></textarea>
          </div>
          <div class="field checkbox-field" *ngIf="isEditing">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
              <span>Empresa activa</span>
            </label>
          </div>
        </section>

        <section class="form-section">
          <h2 class="section-title">Contacto</h2>
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
                   placeholder="empresa@gmail.com" maxlength="200" autocomplete="off"
                   (input)="onEmailInput()" />
            <small class="field-error" *ngIf="emailError">{{ emailError }}</small>
          </div>
        </section>

        <section class="form-actions">
          <p-button type="button" label="Cancelar" [text]="true" [rounded]="true" severity="secondary"
                    (onClick)="cancel()" pTooltip="Cancelar y volver al listado" tooltipPosition="top">
          </p-button>
          <p-button type="submit" [label]="isEditing ? 'Guardar cambios' : 'Guardar empresa'"
                    [text]="true" [rounded]="true" [loading]="isSaving"
                    [pTooltip]="isEditing ? 'Guardar cambios' : 'Guardar nueva empresa'" tooltipPosition="top">
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
    .section-title { font-size:0.9rem; font-weight:600; text-transform:uppercase; letter-spacing:0.06em;
      color:var(--brand-muted); margin:0 0 0.25rem; padding-bottom:0.5rem; border-bottom:1px solid rgba(19,133,182,0.1); }
    .field { display:flex; flex-direction:column; gap:0.4rem; }
    .field label { font-weight:500; font-size:0.92rem; color:var(--brand-ink); }
    .field input, .field textarea { width:100%; padding:0.6rem 0.85rem; border:1px solid rgba(19,133,182,0.25);
      border-radius:10px; font:inherit; font-size:0.95rem; color:var(--brand-ink); background:#fff;
      transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box; }
    .field input:focus, .field textarea:focus { outline:none; border-color:var(--brand-blue); box-shadow:0 0 0 3px rgba(19,133,182,0.12); }
    .field textarea { resize:vertical; min-height:80px; }
    .checkbox-field .checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:500; }
    .checkbox-field input[type=checkbox] { width:16px; height:16px; cursor:pointer; }
    .field-hint  { color:var(--brand-muted); font-size:0.8rem; }
    .field-error { color:#e74c3c; font-size:0.82rem; }
    .phone-row { display:flex; gap:0.6rem; align-items:stretch; }
    .phone-input { flex:1; }
    :host ::ng-deep .phone-prefix-select { width:140px; flex-shrink:0; }
    :host ::ng-deep .phone-prefix-select .p-select { border-radius:10px; border:1px solid rgba(19,133,182,0.25); }
    .form-actions { display:flex; justify-content:flex-end; gap:0.75rem; padding-top:0.5rem; border-top:1px solid rgba(19,133,182,0.08); }
  `]
})
export class CompanyCreatePageComponent implements OnInit {
  private readonly api    = inject(CompaniesApiService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr    = inject(ChangeDetectorRef);
  private readonly msg    = inject(MessageService);

  prefixOptions = PHONE_PREFIXES;
  isEditing  = false;
  editingId  = '';
  editingName = '';
  loading    = false;
  loadError  = '';
  isSaving   = false;
  phoneError = '';
  emailError = '';

  form = { name:'', slug:'', description:'', phonePrefix:'+595', phoneNumber:'', email:'', isActive:true };

  get selectedPrefix() { return PHONE_PREFIXES.find(p => p.value === this.form.phonePrefix); }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditing = true;
      this.editingId = id;
      this.loading = true;
      this.api.getById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: c => {
          this.editingName = c.name;
          this.form = {
            name: c.name, slug: c.slug,
            description: c.description ?? '',
            phonePrefix: c.contactPhonePrefix ?? '+595',
            phoneNumber: c.contactPhone ?? '',
            email: c.contactEmail ?? '',
            isActive: c.isActive
          };
          this.loading = false; this.cdr.markForCheck();
        },
        error: () => { this.loadError = 'No se pudo cargar la empresa.'; this.loading = false; this.cdr.markForCheck(); }
      });
    }
  }

  onSlugInput() { this.form.slug = this.form.slug.toLowerCase().replace(/[^a-z0-9-]/g, ''); }
  onPhoneInput() { this.form.phoneNumber = this.form.phoneNumber.replace(/\D/g, ''); this.phoneError = ''; }
  onEmailInput() { this.emailError = ''; }
  cancel() { this.router.navigate(['/companies']); }

  save(): void {
    this.phoneError = ''; this.emailError = '';
    const name  = this.form.name.trim();
    const slug  = this.form.slug.trim().toLowerCase();
    const description  = this.form.description.trim() || null;
    const phonePrefix  = this.form.phonePrefix || null;
    const phoneNumber  = this.form.phoneNumber.trim() || null;
    const email        = this.form.email.trim().toLowerCase() || null;

    if (!name) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre es obligatorio.', life: 5000 }); return; }
    if (!slug) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El slug es obligatorio.', life: 5000 }); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Slug inválido: solo minúsculas, números y guiones.', life: 5000 }); return; }
    if (phoneNumber) {
      const p = PHONE_PREFIXES.find(x => x.value === phonePrefix);
      if (p && !p.pattern.test(phoneNumber)) { this.phoneError = `Formato inválido para ${p.label}: ${p.hint}.`; return; }
    }
    if (email && !/^[^\s@]+@gmail\.com$/i.test(email)) { this.emailError = 'Por ahora solo se aceptan correos @gmail.com.'; return; }

    const req = { name, slug, isActive: this.form.isActive, description, contactPhonePrefix: phonePrefix, contactPhone: phoneNumber, contactEmail: email };
    this.isSaving = true;
    const op = this.isEditing ? this.api.update(this.editingId, req) : this.api.create(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.isSaving = false; this.router.navigate(['/companies']); },
      error: err => { this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar.'), life: 5000 }); this.isSaving = false; this.cdr.markForCheck(); }
    });
  }
}
