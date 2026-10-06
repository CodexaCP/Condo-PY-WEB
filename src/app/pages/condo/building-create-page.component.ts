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
import {
  BankAccountType, BuildingPropertyType, Company, Condominium, IncomeTreatment, InvoicingMode, LateFeeFrequency,
  TaxpayerType, VatRegime
} from '../../api/models';
import { isPdfFile, pdfFirstPageToPngFile } from '../../api/pdf-to-image.util';
import { UploadsApiService } from '../../api/uploads-api.service';
import { AuthService } from '../../auth/auth.service';
import { resolveUploadUrl } from '../../api/file-url.util';

type TemplateKind = 'invoice' | 'creditNote' | 'settlement';
interface TemplateFile { url: string; fileName: string; }

// Pestañas del formulario: así la ficha no es una página larga.
type TabKey = 'general' | 'legal' | 'billing' | 'accounting' | 'config';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'general',    label: 'Datos generales',      icon: 'pi pi-building' },
  { key: 'legal',      label: 'Legal y registral',    icon: 'pi pi-book' },
  { key: 'billing',    label: 'Facturación',          icon: 'pi pi-receipt' },
  { key: 'accounting', label: 'Contabilidad y pagos', icon: 'pi pi-wallet' },
  { key: 'config',     label: 'Configuración',        icon: 'pi pi-cog' },
];

// Un modelo por concepto; si el edificio no usa los estandar de CONDOPY tiene que adjuntar los tres.
const TEMPLATE_KINDS: { kind: TemplateKind; label: string }[] = [
  { kind: 'invoice',    label: 'Factura' },
  { kind: 'creditNote', label: 'Nota de crédito' },
  { kind: 'settlement', label: 'Liquidación' },
];

interface PhonePrefix { label: string; value: string; flag: string; pattern: RegExp; hint: string; }

const PHONE_PREFIXES: PhonePrefix[] = [
  { label: 'PY +595', value: '+595', flag: '🇵🇾', pattern: /^\d{7,9}$/,   hint: '7-9 dígitos' },
  { label: 'USA +1',  value: '+1',   flag: '🇺🇸', pattern: /^\d{10}$/,    hint: '10 dígitos' },
  { label: 'BR +55',  value: '+55',  flag: '🇧🇷', pattern: /^\d{10,11}$/, hint: '10-11 dígitos' },
  { label: 'ARG +54', value: '+54',  flag: '🇦🇷', pattern: /^\d{10}$/,    hint: '10 dígitos' },
];

// Teléfono con prefijo del país: el backend guarda los opcionales completos (+595981123456).
interface PhoneInput { prefix: string; number: string; }

function emptyPhone(): PhoneInput { return { prefix: '+595', number: '' }; }

function splitPhone(full?: string | null): PhoneInput {
  if (!full) return emptyPhone();
  const match = [...PHONE_PREFIXES].sort((a, b) => b.value.length - a.value.length).find(p => full.startsWith(p.value));
  return match ? { prefix: match.value, number: full.slice(match.value.length) } : { prefix: '+595', number: full.replace(/\D/g, '') };
}

function joinPhone(p: PhoneInput): string | null {
  const number = p.number.trim();
  return number ? `${p.prefix}${number}` : null;
}

function phoneProblem(p: PhoneInput, label: string): string {
  const number = p.number.trim();
  if (!number) return '';
  const prefix = PHONE_PREFIXES.find(x => x.value === p.prefix);
  return prefix && !prefix.pattern.test(number) ? `${label}: formato inválido para ${prefix.label} (${prefix.hint}).` : '';
}

// Dígito verificador del RUC (SET): módulo 11, pesos 2 a 11 de derecha a izquierda. Formato 80012345-0.
function isValidRuc(ruc: string): boolean {
  const m = /^(\d{5,9})-(\d)$/.exec(ruc.trim());
  if (!m) return false;
  let k = 2;
  let total = 0;
  for (let i = m[1].length - 1; i >= 0; i--) {
    if (k > 11) k = 2;
    total += Number(m[1][i]) * k;
    k++;
  }
  const rest = total % 11;
  return (rest > 1 ? 11 - rest : 0) === Number(m[2]);
}

function templateFile(url?: string | null, fileName?: string | null): TemplateFile | null {
  return url ? { url, fileName: fileName || 'modelo' } : null;
}

function nullIfBlank(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  return v ? v : null;
}

function numOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

interface BankAccountForm {
  key: number;
  id: string | null;
  bankName: string;
  accountType: BankAccountType;
  accountNumber: string;
  holderName: string;
  holderDocument: string;
  alias: string;
  isActive: boolean;
}

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

      <ng-template #phoneTpl let-m="model" let-n="name" let-err="error">
        <div class="phone-row">
          <p-select [options]="prefixOptions" [(ngModel)]="m.prefix" [name]="n + 'Prefix'"
                    optionLabel="label" optionValue="value" placeholder="País" styleClass="phone-prefix-select">
            <ng-template pTemplate="selectedItem" let-item>
              <span *ngIf="item">{{ item.flag }} {{ item.value }}</span>
            </ng-template>
            <ng-template pTemplate="item" let-item>
              <span>{{ item.flag }} {{ item.label }}</span>
            </ng-template>
          </p-select>
          <input type="tel" [(ngModel)]="m.number" [name]="n + 'Number'" placeholder="Número de teléfono"
                 class="phone-input" (input)="onOptionalPhoneInput(m)" maxlength="15" />
        </div>
        <small class="field-error" *ngIf="err">{{ err }}</small>
      </ng-template>

      <form class="create-form" (ngSubmit)="save()" *ngIf="!loading && !loadError">

        <nav class="tabs" role="tablist">
          <button type="button" class="tab-btn" role="tab" *ngFor="let t of tabs"
                  [class.active]="activeTab === t.key" [class.has-error]="errorTab === t.key"
                  [attr.aria-selected]="activeTab === t.key" (click)="selectTab(t.key)">
            <i [class]="t.icon"></i> <span>{{ t.label }}</span>
          </button>
        </nav>

        <!-- ═══════════════ DATOS GENERALES ═══════════════ -->
        <ng-container *ngIf="activeTab === 'general'">
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
            <h2 class="section-title">Identificación</h2>
            <div class="field-row">
              <div class="field">
                <label for="name">Nombre <span class="required">*</span></label>
                <input id="name" type="text" [(ngModel)]="form.name" name="name"
                       placeholder="Nombre del edificio" maxlength="120" autocomplete="off" />
              </div>
              <div class="field">
                <label for="code">Código <span class="required">*</span></label>
                <input id="code" type="text" [(ngModel)]="form.code" name="code"
                       placeholder="EDI-001" maxlength="40" autocomplete="off" (input)="onCodeInput()" />
                <small class="field-hint">Solo letras mayúsculas, números y guiones medios.</small>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="propertyType">Tipo de inmueble <span class="optional">(opcional)</span></label>
                <p-select id="propertyType" [options]="propertyTypeOptions" [(ngModel)]="form.propertyType"
                          name="propertyType" optionLabel="label" optionValue="value" placeholder="Seleccionar..."
                          [showClear]="true" styleClass="full-select">
                </p-select>
              </div>
              <div class="field checkbox-field" *ngIf="isEditing">
                <label>Estado</label>
                <label class="checkbox-label">
                  <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" [disabled]="isBuildingManager" />
                  <span>Edificio activo</span>
                </label>
              </div>
            </div>
            <div class="field">
              <label for="description">Descripción</label>
              <textarea pTextarea id="description" [(ngModel)]="form.description" name="description"
                        placeholder="Descripción del edificio" rows="3" maxlength="500"></textarea>
            </div>
          </section>

          <section class="form-section">
            <h2 class="section-title">Ubicación</h2>
            <div class="field">
              <label for="address">Dirección <span class="required">*</span></label>
              <input id="address" type="text" [(ngModel)]="form.address" name="address"
                     placeholder="Dirección del edificio" maxlength="200" autocomplete="off" />
            </div>
            <div class="field-row-3">
              <div class="field">
                <label for="department">Departamento</label>
                <input id="department" type="text" [(ngModel)]="form.department" name="department" list="py-departments"
                       placeholder="Ej: Central" maxlength="100" autocomplete="off" />
                <datalist id="py-departments">
                  <option *ngFor="let d of departments" [value]="d"></option>
                </datalist>
              </div>
              <div class="field">
                <label for="city">Ciudad</label>
                <input id="city" type="text" [(ngModel)]="form.city" name="city" placeholder="Ej: Asunción" maxlength="100" autocomplete="off" />
              </div>
              <div class="field">
                <label for="neighborhood">Barrio</label>
                <input id="neighborhood" type="text" [(ngModel)]="form.neighborhood" name="neighborhood" maxlength="100" autocomplete="off" />
              </div>
            </div>
            <div class="field">
              <label for="locationReference">Referencia de ubicación <span class="optional">(opcional)</span></label>
              <input id="locationReference" type="text" [(ngModel)]="form.locationReference" name="locationReference"
                     placeholder="Ej: Esquina con Av. Mariscal López, frente a la plaza" maxlength="300" autocomplete="off" />
            </div>
            <div class="field-row">
              <div class="field">
                <label for="latitude">Latitud <span class="optional">(opcional)</span></label>
                <input id="latitude" type="number" [(ngModel)]="form.latitude" name="latitude" step="any" min="-90" max="90" placeholder="-25.282200" />
              </div>
              <div class="field">
                <label for="longitude">Longitud <span class="optional">(opcional)</span></label>
                <input id="longitude" type="number" [(ngModel)]="form.longitude" name="longitude" step="any" min="-180" max="180" placeholder="-57.635100" />
              </div>
            </div>
            <small class="field-hint" *ngIf="hasCoordinates">
              <a [href]="mapUrl" target="_blank" rel="noopener"><i class="pi pi-map-marker"></i> Ver ubicación en el mapa</a>
            </small>
          </section>

          <section class="form-section">
            <h2 class="section-title">Descripción física</h2>
            <div class="field-row-4">
              <div class="field">
                <label for="yearBuilt">Año de construcción</label>
                <input id="yearBuilt" type="number" [(ngModel)]="form.yearBuilt" name="yearBuilt" min="1800" max="2100" placeholder="Ej: 2015" />
              </div>
              <div class="field">
                <label for="towersCount">Torres</label>
                <input id="towersCount" type="number" [(ngModel)]="form.towersCount" name="towersCount" min="0" max="500" />
              </div>
              <div class="field">
                <label for="floorsCount">Pisos</label>
                <input id="floorsCount" type="number" [(ngModel)]="form.floorsCount" name="floorsCount" min="0" max="500" />
              </div>
              <div class="field">
                <label for="unitsCount">Unidades</label>
                <input id="unitsCount" type="number" [(ngModel)]="form.unitsCount" name="unitsCount" min="0" max="100000" />
              </div>
            </div>
            <small class="field-hint">Datos informativos: las unidades reales se cargan en la pantalla de Unidades.</small>
          </section>

          <section class="form-section">
            <h2 class="section-title">Contacto y administración</h2>
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
            <div class="field-row">
              <div class="field">
                <label>WhatsApp <span class="optional">(opcional)</span></label>
                <ng-container *ngTemplateOutlet="phoneTpl; context: { model: form.whatsApp, name: 'whatsApp', error: phoneErrors['whatsApp'] }"></ng-container>
              </div>
              <div class="field">
                <label for="officeHours">Horario de administración <span class="optional">(opcional)</span></label>
                <input id="officeHours" type="text" [(ngModel)]="form.officeHours" name="officeHours"
                       placeholder="Ej: Lun a Vie 8:00 a 17:00" maxlength="200" autocomplete="off" />
              </div>
            </div>
          </section>

          <section class="form-section">
            <h2 class="section-title">Logo</h2>
            <div class="logo-row">
              <img *ngIf="form.logoUrl" class="logo-preview" [src]="fileUrl(form.logoUrl)" alt="Logo del edificio" />
              <div class="logo-actions">
                <label class="template-upload" [class.disabled]="uploadingLogo">
                  <i class="pi" [class.pi-upload]="!uploadingLogo" [class.pi-spin]="uploadingLogo" [class.pi-spinner]="uploadingLogo"></i>
                  {{ uploadingLogo ? 'Subiendo...' : (form.logoUrl ? 'Cambiar logo' : 'Adjuntar logo') }}
                  <input type="file" accept=".png,.jpg,.jpeg,.webp" hidden [disabled]="uploadingLogo" (change)="onLogoSelected($event)" />
                </label>
                <button type="button" class="template-remove" *ngIf="form.logoUrl" (click)="form.logoUrl = ''" pTooltip="Quitar logo" tooltipPosition="top">
                  <i class="pi pi-times"></i>
                </button>
              </div>
            </div>
            <small class="field-hint">Imagen PNG, JPG o WebP, hasta 10 MB.</small>
          </section>
        </ng-container>

        <!-- ═══════════════ LEGAL Y REGISTRAL ═══════════════ -->
        <ng-container *ngIf="activeTab === 'legal'">
          <section class="form-section">
            <h2 class="section-title">Datos registrales del inmueble</h2>
            <div class="field-row-3">
              <div class="field">
                <label for="fincaNumber">Finca / matrícula</label>
                <input id="fincaNumber" type="text" [(ngModel)]="form.fincaNumber" name="fincaNumber" maxlength="50" autocomplete="off" />
              </div>
              <div class="field">
                <label for="padronNumber">Padrón</label>
                <input id="padronNumber" type="text" [(ngModel)]="form.padronNumber" name="padronNumber" maxlength="50" autocomplete="off" />
              </div>
              <div class="field">
                <label for="cadastralAccount">Cuenta corriente catastral</label>
                <input id="cadastralAccount" type="text" [(ngModel)]="form.cadastralAccount" name="cadastralAccount" maxlength="50" autocomplete="off" />
              </div>
            </div>
          </section>

          <section class="form-section">
            <h2 class="section-title">Personería jurídica y reglamento</h2>
            <div class="field-row">
              <div class="field">
                <label for="legalEntityNumber">Número de personería jurídica</label>
                <input id="legalEntityNumber" type="text" [(ngModel)]="form.legalEntityNumber" name="legalEntityNumber" maxlength="50" autocomplete="off" />
              </div>
              <div class="field">
                <label for="legalEntityDate">Fecha de la personería</label>
                <input id="legalEntityDate" type="date" [(ngModel)]="form.legalEntityDate" name="legalEntityDate" />
              </div>
            </div>
            <div class="field">
              <label>Reglamento de copropiedad</label>
              <div class="template-row">
                <ng-container *ngIf="form.bylaws as file; else noBylaws">
                  <a class="template-file" [href]="fileUrl(file.url)" target="_blank" rel="noopener">
                    <i class="pi pi-file"></i> {{ file.fileName }}
                  </a>
                  <button type="button" class="template-remove" (click)="form.bylaws = null" pTooltip="Quitar documento" tooltipPosition="top">
                    <i class="pi pi-times"></i>
                  </button>
                </ng-container>
                <ng-template #noBylaws>
                  <label class="template-upload" [class.disabled]="uploadingBylaws">
                    <i class="pi" [class.pi-upload]="!uploadingBylaws" [class.pi-spin]="uploadingBylaws" [class.pi-spinner]="uploadingBylaws"></i>
                    {{ uploadingBylaws ? 'Subiendo...' : 'Adjuntar documento' }}
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" hidden [disabled]="uploadingBylaws" (change)="onBylawsSelected($event)" />
                  </label>
                </ng-template>
              </div>
              <small class="field-hint">PDF o imagen, hasta 10 MB.</small>
            </div>
          </section>

          <section class="form-section">
            <h2 class="section-title">Responsables y emergencias</h2>
            <div class="field-row">
              <div class="field">
                <label for="administratorName">Administrador responsable</label>
                <input id="administratorName" type="text" [(ngModel)]="form.administratorName" name="administratorName" maxlength="200" autocomplete="off" />
              </div>
              <div class="field">
                <label>Teléfono del administrador</label>
                <ng-container *ngTemplateOutlet="phoneTpl; context: { model: form.administratorPhone, name: 'adminPhone', error: phoneErrors['adminPhone'] }"></ng-container>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="emergencyContactName">Contacto de emergencia</label>
                <input id="emergencyContactName" type="text" [(ngModel)]="form.emergencyContactName" name="emergencyContactName" maxlength="200" autocomplete="off" />
              </div>
              <div class="field">
                <label>Teléfono de emergencia</label>
                <ng-container *ngTemplateOutlet="phoneTpl; context: { model: form.emergencyContactPhone, name: 'emergencyPhone', error: phoneErrors['emergencyPhone'] }"></ng-container>
              </div>
            </div>
            <small class="field-hint">El presidente del consorcio se asigna desde la pantalla de usuarios del edificio.</small>
          </section>
        </ng-container>

        <!-- ═══════════════ FACTURACIÓN ═══════════════ -->
        <ng-container *ngIf="activeTab === 'billing'">
          <section class="form-section">
            <h2 class="section-title">Datos fiscales</h2>
            <p-message *ngIf="isBuildingManager" severity="info" text="Los datos fiscales los define la administración."></p-message>
            <div class="field-row">
              <div class="field">
                <label for="ruc">RUC</label>
                <input id="ruc" type="text" [(ngModel)]="form.ruc" name="ruc" placeholder="Ej: 80012345-0" maxlength="20"
                       autocomplete="off" [disabled]="isBuildingManager" (input)="rucError = ''" />
                <small class="field-error" *ngIf="rucError">{{ rucError }}</small>
                <small class="field-hint" *ngIf="!rucError">Con guion y dígito verificador. Se valida al guardar.</small>
              </div>
              <div class="field">
                <label for="legalName">Razón social</label>
                <input id="legalName" type="text" [(ngModel)]="form.legalName" name="legalName"
                       placeholder="Nombre legal del contribuyente" maxlength="200" autocomplete="off" [disabled]="isBuildingManager" />
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="taxpayerType">Tipo de contribuyente</label>
                <p-select id="taxpayerType" [options]="taxpayerTypeOptions" [(ngModel)]="form.taxpayerType" name="taxpayerType"
                          optionLabel="label" optionValue="value" placeholder="Seleccionar..." [showClear]="true"
                          styleClass="full-select" [disabled]="isBuildingManager">
                </p-select>
              </div>
              <div class="field">
                <label for="vatRegime">Régimen de IVA</label>
                <p-select id="vatRegime" [options]="vatRegimeOptions" [(ngModel)]="form.vatRegime" name="vatRegime"
                          optionLabel="label" optionValue="value" placeholder="Seleccionar..." [showClear]="true"
                          styleClass="full-select" [disabled]="isBuildingManager">
                </p-select>
              </div>
            </div>
            <div class="field">
              <label for="economicActivity">Actividad económica</label>
              <input id="economicActivity" type="text" [(ngModel)]="form.economicActivity" name="economicActivity"
                     placeholder="Ej: Administración de condominios" maxlength="200" autocomplete="off" [disabled]="isBuildingManager" />
            </div>
            <div class="field-row">
              <div class="field">
                <label for="fiscalAddress">Dirección fiscal</label>
                <input id="fiscalAddress" type="text" [(ngModel)]="form.fiscalAddress" name="fiscalAddress"
                       placeholder="Si se deja vacía, se usa la dirección del edificio" maxlength="300" autocomplete="off" [disabled]="isBuildingManager" />
              </div>
              <div class="field">
                <label for="invoiceEmail">Email para recibir comprobantes</label>
                <input id="invoiceEmail" type="email" [(ngModel)]="form.invoiceEmail" name="invoiceEmail"
                       placeholder="facturas@edificio.com" maxlength="160" autocomplete="off" [disabled]="isBuildingManager" />
              </div>
            </div>
            <small class="field-hint">
              Estos datos se completan solos al crear un timbrado nuevo para el edificio. La numeración y la vigencia de los
              timbrados se gestionan en el menú Timbrados.
            </small>
          </section>

          <section class="form-section" *ngIf="isSuperAdmin">
            <h2 class="section-title">Modo de Facturación</h2>
            <div class="field">
              <label for="invoicingMode">Modo de facturación <span class="required">*</span></label>
              <p-select id="invoicingMode" [options]="invoicingModeOptions" [(ngModel)]="form.invoicingMode"
                        name="invoicingMode" optionLabel="label" optionValue="value"
                        placeholder="Seleccionar..." styleClass="full-select">
              </p-select>
            </div>
          </section>

          <section class="form-section" *ngIf="isSuperAdmin">
            <h2 class="section-title">Modelos de documentos</h2>
            <div class="field checkbox-field">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="form.useStandardTemplates" name="useStandardTemplates" />
                <span>Usar modelos estándar de CONDOPY</span>
              </label>
              <small class="field-hint">
                Factura, nota de crédito y liquidación se descargan con el diseño estándar de CONDOPY (colores de la marca).
                Si lo desmarcás, adjuntá los 3 modelos propios del edificio, uno por concepto.
              </small>
            </div>

            <div class="template-list" *ngIf="!form.useStandardTemplates">
              <div class="template-row" *ngFor="let t of templateKinds">
                <span class="template-label">{{ t.label }} <span class="required">*</span></span>
                <ng-container *ngIf="form.templates[t.kind] as file; else noFile">
                  <a class="template-file" [href]="fileUrl(file.url)" target="_blank" rel="noopener">
                    <i class="pi pi-file"></i> {{ file.fileName }}
                  </a>
                  <button type="button" class="template-remove" (click)="removeTemplate(t.kind)" pTooltip="Quitar modelo" tooltipPosition="top">
                    <i class="pi pi-times"></i>
                  </button>
                </ng-container>
                <ng-template #noFile>
                  <label class="template-upload" [class.disabled]="uploadingTemplate === t.kind">
                    <i class="pi" [class.pi-upload]="uploadingTemplate !== t.kind" [class.pi-spin]="uploadingTemplate === t.kind"
                       [class.pi-spinner]="uploadingTemplate === t.kind"></i>
                    {{ uploadingTemplate === t.kind ? 'Subiendo...' : 'Adjuntar modelo' }}
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" hidden
                           [disabled]="uploadingTemplate !== null" (change)="onTemplateSelected(t.kind, $event)" />
                  </label>
                </ng-template>
              </div>
              <small class="field-hint">PDF o imagen, hasta 10 MB cada uno.</small>
            </div>
          </section>
        </ng-container>

        <!-- ═══════════════ CONTABILIDAD Y PAGOS ═══════════════ -->
        <ng-container *ngIf="activeTab === 'accounting'">
          <section class="form-section">
            <h2 class="section-title">Vencimiento y cobranza</h2>
            <div class="field-row">
              <div class="field">
                <label for="defaultDueDay">Día de vencimiento por defecto <span class="optional">(opcional)</span></label>
                <input id="defaultDueDay" type="number" [(ngModel)]="form.defaultDueDay" name="defaultDueDay"
                       placeholder="Ej: 10" min="1" max="31" [disabled]="isBuildingManager" />
                <small class="field-hint">Al crear un período nuevo, el vencimiento se propone ese día del mes siguiente. Vacío = día 10.</small>
              </div>
              <div class="field">
                <label for="graceDays">Días de gracia <span class="optional">(opcional)</span></label>
                <input id="graceDays" type="number" [(ngModel)]="form.graceDays" name="graceDays"
                       placeholder="Ej: 5" min="0" max="365" [disabled]="isBuildingManager" />
                <small class="field-hint">Al crear un período nuevo, el corte de mora se propone esos días después del vencimiento.</small>
              </div>
            </div>
            <div class="field">
              <label for="paymentInstructions">Instrucciones de pago <span class="optional">(opcional)</span></label>
              <textarea pTextarea id="paymentInstructions" [(ngModel)]="form.paymentInstructions" name="paymentInstructions"
                        placeholder="Ej: Transferir a la cuenta indicada y enviar el comprobante a la administración." rows="3"
                        maxlength="1000" [disabled]="isBuildingManager"></textarea>
            </div>
          </section>

          <section class="form-section">
            <h2 class="section-title">Aportes de la liquidación</h2>
            <div class="field">
              <label for="incomeTreatment">Ingresos del período (saldo acumulado, alquileres, intereses...)</label>
              <p-select id="incomeTreatment" [options]="incomeTreatmentOptions" [(ngModel)]="form.incomeTreatment"
                        name="incomeTreatment" optionLabel="label" optionValue="value"
                        styleClass="full-select" [disabled]="isBuildingManager">
              </p-select>
              <small class="field-hint">Acreditar: se reparten como descuento en la expensa de cada propietario. Ir al fondo de reserva: no reducen lo que se cobra.</small>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="reservePct">Aporte al fondo de reserva (%) <span class="optional">(opcional)</span></label>
                <input id="reservePct" type="number" [(ngModel)]="form.reserveFundPercentage" name="reserveFundPercentage"
                       placeholder="Ej: 10" min="0" max="100" step="0.01" [disabled]="isBuildingManager" />
                <small class="field-hint">Porcentaje de los gastos comunes. Se cobra solo a las unidades (por coeficiente) al generar los cargos: no lo cargues también como gasto. Vacío = no se calcula.</small>
              </div>
              <div class="field">
                <label for="extraPct">Aporte extraordinario (%) <span class="optional">(opcional)</span></label>
                <input id="extraPct" type="number" [(ngModel)]="form.extraordinaryPercentage" name="extraordinaryPercentage"
                       placeholder="Ej: 20" min="0" max="100" step="0.01" [disabled]="isBuildingManager" />
                <small class="field-hint">Porcentaje del sub total (gastos comunes + aporte de reserva). Se cobra solo a las unidades, como aporte extraordinario, al generar los cargos: no lo cargues también como gasto. Vacío = no se calcula.</small>
              </div>
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

          <section class="form-section">
            <h2 class="section-title">Cuentas bancarias de cobro</h2>
            <small class="field-hint">Cuentas donde el edificio recibe los pagos. Hasta {{ maxBankAccounts }}.</small>

            <div class="bank-list">
              <div class="bank-card" *ngFor="let a of form.bankAccounts; let i = index; trackBy: trackBank">
                <div class="bank-card-head">
                  <strong>Cuenta {{ i + 1 }}</strong>
                  <label class="checkbox-label">
                    <input type="checkbox" [(ngModel)]="a.isActive" [name]="'bankActive' + a.key" [disabled]="isBuildingManager" />
                    <span>Activa</span>
                  </label>
                  <button type="button" class="template-remove" *ngIf="!isBuildingManager" (click)="removeBankAccount(i)"
                          pTooltip="Quitar cuenta" tooltipPosition="top"><i class="pi pi-trash"></i></button>
                </div>
                <div class="field-row">
                  <div class="field">
                    <label>Banco <span class="required">*</span></label>
                    <input type="text" [(ngModel)]="a.bankName" [name]="'bankName' + a.key" maxlength="120"
                           placeholder="Ej: Banco Itaú" autocomplete="off" [disabled]="isBuildingManager" />
                  </div>
                  <div class="field">
                    <label>Tipo de cuenta</label>
                    <p-select [options]="bankAccountTypeOptions" [(ngModel)]="a.accountType" [name]="'bankType' + a.key"
                              optionLabel="label" optionValue="value" styleClass="full-select" [disabled]="isBuildingManager">
                    </p-select>
                  </div>
                </div>
                <div class="field-row">
                  <div class="field">
                    <label>Número de cuenta <span class="required">*</span></label>
                    <input type="text" [(ngModel)]="a.accountNumber" [name]="'bankNumber' + a.key" maxlength="40"
                           autocomplete="off" [disabled]="isBuildingManager" />
                  </div>
                  <div class="field">
                    <label>Alias <span class="optional">(opcional)</span></label>
                    <input type="text" [(ngModel)]="a.alias" [name]="'bankAlias' + a.key" maxlength="60"
                           autocomplete="off" [disabled]="isBuildingManager" />
                  </div>
                </div>
                <div class="field-row">
                  <div class="field">
                    <label>Titular <span class="required">*</span></label>
                    <input type="text" [(ngModel)]="a.holderName" [name]="'bankHolder' + a.key" maxlength="200"
                           autocomplete="off" [disabled]="isBuildingManager" />
                  </div>
                  <div class="field">
                    <label>Documento del titular (RUC / CI) <span class="optional">(opcional)</span></label>
                    <input type="text" [(ngModel)]="a.holderDocument" [name]="'bankDoc' + a.key" maxlength="30"
                           autocomplete="off" [disabled]="isBuildingManager" />
                  </div>
                </div>
              </div>
              <div class="app-state" *ngIf="!form.bankAccounts.length">Todavía no hay cuentas bancarias cargadas.</div>
            </div>
            <div>
              <p-button type="button" label="Agregar cuenta" icon="pi pi-plus" [text]="true" [rounded]="true"
                        *ngIf="!isBuildingManager && form.bankAccounts.length < maxBankAccounts" (onClick)="addBankAccount()">
              </p-button>
            </div>
          </section>
        </ng-container>

        <!-- ═══════════════ CONFIGURACIÓN ═══════════════ -->
        <ng-container *ngIf="activeTab === 'config'">
          <section class="form-section">
            <h2 class="section-title">Reservas de amenities</h2>
            <div class="field checkbox-field">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="form.blockOverdueAmenityReservations" name="blockOverdueAmenityReservations" />
                <span>Bloquear reservas de amenities a unidades en mora</span>
              </label>
              <small class="field-hint">
                Si está activo, los propietarios/residentes con pagos vencidos no podrán crear nuevas reservas
                (solo podrán pagar su deuda) y sus reservas pendientes de pago se cancelan automáticamente al entrar en mora.
                Opcional — desactivado por defecto.
              </small>
            </div>
          </section>

          <section class="form-section">
            <h2 class="section-title">Regional</h2>
            <div class="field">
              <label for="timeZoneId">Zona horaria</label>
              <p-select id="timeZoneId" [options]="timeZoneOptions" [(ngModel)]="form.timeZoneId" name="timeZoneId"
                        optionLabel="label" optionValue="value" styleClass="full-select">
              </p-select>
              <small class="field-hint">Dato de registro del edificio. Por ahora el sistema opera con la hora de Paraguay.</small>
            </div>
          </section>

          <section class="form-section" *ngIf="isEditing">
            <h2 class="section-title">Módulos contratados</h2>
            <div class="module-chips">
              <span class="module-chip" [class.on]="modules.finance"><i class="pi" [class.pi-check-circle]="modules.finance" [class.pi-minus-circle]="!modules.finance"></i> Finanzas</span>
              <span class="module-chip" [class.on]="modules.marketplace"><i class="pi" [class.pi-check-circle]="modules.marketplace" [class.pi-minus-circle]="!modules.marketplace"></i> Marketplace</span>
              <span class="module-chip" [class.on]="modules.ads"><i class="pi" [class.pi-check-circle]="modules.ads" [class.pi-minus-circle]="!modules.ads"></i> Publicidad</span>
            </div>
            <small class="field-hint">Los módulos y el plan los activa el administrador de CONDOPY desde su propia pantalla.</small>
          </section>
        </ng-container>

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
    .tabs { display:flex; gap:0.25rem; border-bottom:2px solid rgba(19,133,182,0.1); overflow-x:auto; }
    .tab-btn { background:none; border:none; padding:0.6rem 1.1rem; cursor:pointer; font:inherit; font-size:0.9rem; font-weight:600;
      color:var(--brand-muted); border-bottom:2px solid transparent; margin-bottom:-2px; white-space:nowrap;
      display:inline-flex; align-items:center; gap:0.45rem; transition:color 0.15s,border-color 0.15s; }
    .tab-btn:hover { color:var(--brand-blue); }
    .tab-btn.active { color:var(--brand-blue); border-bottom-color:var(--brand-blue); }
    .tab-btn.has-error { color:#e74c3c; }
    .tab-btn.has-error::after { content:''; width:7px; height:7px; border-radius:50%; background:#e74c3c; }
    .form-section { display:flex; flex-direction:column; gap:1.25rem; }
    .field-row { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }
    .field-row-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:1.25rem; }
    .field-row-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:1.25rem; }
    @media (max-width: 720px) {
      .field-row, .field-row-3, .field-row-4 { grid-template-columns:1fr; }
    }
    .section-title { font-size:0.9rem; font-weight:600; text-transform:uppercase; letter-spacing:0.06em;
      color:var(--brand-muted); margin:0 0 0.25rem; padding-bottom:0.5rem; border-bottom:1px solid rgba(19,133,182,0.1); }
    .field { display:flex; flex-direction:column; gap:0.4rem; }
    .field label { font-weight:500; font-size:0.92rem; color:var(--brand-ink); }
    .required { color:#e74c3c; font-weight:600; }
    .optional { font-weight:400; font-size:0.82rem; color:var(--brand-muted); }
    .field input:not([type=checkbox]), .field textarea { width:100%; padding:0.6rem 0.85rem; border:1px solid rgba(19,133,182,0.25);
      border-radius:10px; font:inherit; font-size:0.95rem; color:var(--brand-ink); background:#fff;
      transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box; }
    .field input:focus, .field textarea:focus { outline:none; border-color:var(--brand-blue); box-shadow:0 0 0 3px rgba(19,133,182,0.12); }
    .field input:disabled, .field textarea:disabled { background:rgba(19,133,182,0.04); color:var(--brand-muted); cursor:not-allowed; }
    .field textarea { resize:vertical; min-height:80px; }
    .checkbox-field .checkbox-label, .bank-card-head .checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:500; }
    .checkbox-field input[type=checkbox], .bank-card-head input[type=checkbox] { width:16px; height:16px; cursor:pointer; }
    .readonly-badge { padding:0.5rem 0.85rem; background:rgba(19,133,182,0.06); border:1px solid rgba(19,133,182,0.15);
      border-radius:10px; font-weight:600; color:var(--brand-blue); font-size:0.95rem; }
    .field-hint  { color:var(--brand-muted); font-size:0.8rem; }
    .field-hint a { color:var(--brand-blue); text-decoration:none; }
    .field-error { color:#e74c3c; font-size:0.82rem; }
    .phone-row { display:flex; gap:0.6rem; align-items:stretch; }
    .phone-input { flex:1; }
    :host ::ng-deep .phone-prefix-select { width:140px; flex-shrink:0; }
    :host ::ng-deep .phone-prefix-select .p-select,
    :host ::ng-deep .full-select .p-select { border-radius:10px; border:1px solid rgba(19,133,182,0.25); }
    :host ::ng-deep .full-select { width:100%; }
    .template-list { display:flex; flex-direction:column; gap:0.6rem; }
    .template-row { display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap; padding:0.6rem 0.85rem;
      border:1px solid rgba(19,133,182,0.15); border-radius:10px; }
    .template-label { font-weight:500; min-width:140px; color:var(--brand-ink); }
    .template-file { display:inline-flex; align-items:center; gap:0.4rem; color:var(--brand-blue); text-decoration:none; word-break:break-all; }
    .template-remove { background:none; border:none; cursor:pointer; color:var(--brand-muted); }
    .template-remove:hover { color:#e74c3c; }
    .template-upload { display:inline-flex; align-items:center; gap:0.4rem; cursor:pointer; color:var(--brand-blue); font-weight:500; }
    .template-upload.disabled { cursor:progress; opacity:0.7; }
    .logo-row { display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap; }
    .logo-preview { width:96px; height:96px; object-fit:contain; border:1px solid rgba(19,133,182,0.2); border-radius:12px; background:#fff; padding:0.35rem; }
    .logo-actions { display:flex; align-items:center; gap:0.75rem; }
    .bank-list { display:flex; flex-direction:column; gap:1rem; }
    .bank-card { display:flex; flex-direction:column; gap:1rem; padding:1rem 1.1rem; border:1px solid rgba(19,133,182,0.18); border-radius:12px; }
    .bank-card-head { display:flex; align-items:center; gap:1rem; }
    .bank-card-head strong { flex:1; color:var(--brand-ink); }
    .module-chips { display:flex; gap:0.6rem; flex-wrap:wrap; }
    .module-chip { display:inline-flex; align-items:center; gap:0.4rem; padding:0.35rem 0.8rem; border-radius:999px; font-size:0.88rem;
      font-weight:600; color:var(--brand-muted); background:rgba(19,133,182,0.06); }
    .module-chip.on { color:#1b8a4b; background:rgba(27,138,75,0.1); }
    .form-actions { display:flex; justify-content:flex-end; gap:0.75rem; padding-top:0.5rem; border-top:1px solid rgba(19,133,182,0.08); }
  `]
})
export class BuildingCreatePageComponent implements OnInit {
  // El backend guarda los archivos subidos como ruta relativa (/uploads/x.jpg): hay que anteponer el origen de la API.
  readonly fileUrl = resolveUploadUrl;
  private readonly api             = inject(BuildingsApiService);
  private readonly companiesApi    = inject(CompaniesApiService);
  private readonly condominiumsApi = inject(CondominiumsApiService);
  private readonly auth            = inject(AuthService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly destroyRef      = inject(DestroyRef);
  private readonly cdr             = inject(ChangeDetectorRef);
  private readonly msg             = inject(MessageService);
  private readonly uploadsApi      = inject(UploadsApiService);

  readonly tabs = TABS;
  activeTab: TabKey = 'general';
  errorTab: TabKey | null = null;

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
  uploadingTemplate: TemplateKind | null = null;
  uploadingLogo = false;
  uploadingBylaws = false;
  readonly templateKinds = TEMPLATE_KINDS;
  readonly maxBankAccounts = 10;
  phoneError = '';
  emailError = '';
  rucError = '';
  phoneErrors: Record<string, string> = {};
  private originalRuc = '';
  private bankKeySeq = 0;
  modules = { finance: false, marketplace: false, ads: false };

  form = {
    companyId: '', condominiumId: '', name: '', code: '', address: '', description: '',
    phonePrefix: '+595', phoneNumber: '', email: '', isActive: true,
    lateFeeRatePercentage: null as number | null, lateFeeFrequency: '' as '' | LateFeeFrequency,
    reserveFundPercentage: null as number | null, extraordinaryPercentage: null as number | null,
    incomeTreatment: 'CreditToOwners' as IncomeTreatment,
    blockOverdueAmenityReservations: false,
    invoicingMode: '' as '' | InvoicingMode,
    useStandardTemplates: true,
    templates: { invoice: null, creditNote: null, settlement: null } as Record<TemplateKind, TemplateFile | null>,

    // Datos generales
    propertyType: null as BuildingPropertyType | null,
    department: '', city: '', neighborhood: '', locationReference: '',
    latitude: null as number | null, longitude: null as number | null,
    yearBuilt: null as number | null, towersCount: null as number | null,
    floorsCount: null as number | null, unitsCount: null as number | null,
    logoUrl: '', whatsApp: emptyPhone(), officeHours: '',

    // Legal y registral
    fincaNumber: '', padronNumber: '', cadastralAccount: '',
    legalEntityNumber: '', legalEntityDate: '',
    bylaws: null as TemplateFile | null,
    administratorName: '', administratorPhone: emptyPhone(),
    emergencyContactName: '', emergencyContactPhone: emptyPhone(),

    // Facturación (datos fiscales)
    ruc: '', legalName: '',
    taxpayerType: null as TaxpayerType | null, vatRegime: null as VatRegime | null,
    economicActivity: '', fiscalAddress: '', invoiceEmail: '',

    // Contabilidad y pagos
    defaultDueDay: null as number | null, graceDays: null as number | null, paymentInstructions: '',
    bankAccounts: [] as BankAccountForm[],

    // Configuración
    timeZoneId: 'America/Asuncion'
  };

  readonly lateFeeFrequencyOptions = [
    { label: 'Diario', value: 'Daily' },
    { label: 'Semanal', value: 'Weekly' },
    { label: 'Quincenal', value: 'Biweekly' }
  ];

  readonly incomeTreatmentOptions: { label: string; value: IncomeTreatment }[] = [
    { label: 'Acreditar a los propietarios (descuento en la expensa)', value: 'CreditToOwners' },
    { label: 'Van al fondo de reserva (no reducen la expensa)', value: 'ToReserveFund' }
  ];

  readonly invoicingModeOptions = [
    { label: 'Preimpresa', value: 'Preimpresa' },
    { label: 'Autoimpresa', value: 'Autoimpresa' },
    { label: 'Electrónica', value: 'Electronica' }
  ];

  readonly propertyTypeOptions: { label: string; value: BuildingPropertyType }[] = [
    { label: 'Edificio', value: 'Building' },
    { label: 'Torre', value: 'Tower' },
    { label: 'Condominio horizontal', value: 'HorizontalCondominium' },
    { label: 'Barrio cerrado', value: 'GatedCommunity' },
    { label: 'Otro', value: 'Other' }
  ];

  readonly taxpayerTypeOptions: { label: string; value: TaxpayerType }[] = [
    { label: 'Persona jurídica', value: 'Legal' },
    { label: 'Persona física', value: 'Natural' }
  ];

  readonly vatRegimeOptions: { label: string; value: VatRegime }[] = [
    { label: 'Contribuyente general (IVA 10% / 5%)', value: 'General' },
    { label: 'RESIMPLE', value: 'Resimple' },
    { label: 'Exento', value: 'Exempt' }
  ];

  readonly bankAccountTypeOptions: { label: string; value: BankAccountType }[] = [
    { label: 'Cuenta corriente', value: 'Checking' },
    { label: 'Caja de ahorro', value: 'Savings' }
  ];

  readonly timeZoneOptions = [
    { label: 'Paraguay (Asunción)', value: 'America/Asuncion' },
    { label: 'Argentina (Buenos Aires)', value: 'America/Argentina/Buenos_Aires' },
    { label: 'Brasil (São Paulo)', value: 'America/Sao_Paulo' },
    { label: 'Uruguay (Montevideo)', value: 'America/Montevideo' }
  ];

  readonly departments = [
    'Asunción (Capital)', 'Central', 'Alto Paraná', 'Itapúa', 'Caaguazú', 'San Pedro', 'Cordillera', 'Paraguarí',
    'Guairá', 'Caazapá', 'Misiones', 'Ñeembucú', 'Amambay', 'Canindeyú', 'Concepción', 'Presidente Hayes',
    'Boquerón', 'Alto Paraguay'
  ];

  get isSuperAdmin()       { return this.auth.hasRole('SuperAdmin'); }
  get isBuildingManager()  { return this.auth.hasRole('BuildingManager'); }
  get isCompanyAdmin()     { return this.auth.hasRole('CompanyAdmin'); }
  get condominiumLocked()  { return this.isCompanyAdmin && !!this.auth.currentUser()?.condominiumId; }
  get lockedCondominiumName() {
    const condId = this.auth.currentUser()?.condominiumId;
    return condId ? (this.allCondominiums.find(c => c.id === condId)?.name ?? condId) : '';
  }
  get selectedPrefix() { return PHONE_PREFIXES.find(p => p.value === this.form.phonePrefix); }
  get hasCoordinates() { return this.form.latitude !== null && this.form.longitude !== null && this.form.latitude !== undefined && this.form.longitude !== undefined; }
  get mapUrl() { return `https://www.google.com/maps?q=${this.form.latitude},${this.form.longitude}`; }

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
          this.originalRuc = entity.ruc ?? '';
          this.modules = {
            finance: !!entity.financeModuleEnabled,
            marketplace: !!entity.marketplaceEnabled,
            ads: !!entity.adsEnabled
          };
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
            incomeTreatment: entity.incomeTreatment ?? 'CreditToOwners',
            reserveFundPercentage: entity.reserveFundPercentage ?? null,
            extraordinaryPercentage: entity.extraordinaryPercentage ?? null,
            lateFeeFrequency: entity.lateFeeFrequency ?? '',
            blockOverdueAmenityReservations: entity.blockOverdueAmenityReservations ?? false,
            invoicingMode: entity.invoicingMode ?? '',
            useStandardTemplates: entity.useStandardTemplates ?? true,
            templates: {
              invoice:    templateFile(entity.invoiceTemplateUrl, entity.invoiceTemplateFileName),
              creditNote: templateFile(entity.creditNoteTemplateUrl, entity.creditNoteTemplateFileName),
              settlement: templateFile(entity.settlementTemplateUrl, entity.settlementTemplateFileName)
            },

            propertyType: entity.propertyType ?? null,
            department: entity.department ?? '', city: entity.city ?? '', neighborhood: entity.neighborhood ?? '',
            locationReference: entity.locationReference ?? '',
            latitude: entity.latitude ?? null, longitude: entity.longitude ?? null,
            yearBuilt: entity.yearBuilt ?? null, towersCount: entity.towersCount ?? null,
            floorsCount: entity.floorsCount ?? null, unitsCount: entity.unitsCount ?? null,
            logoUrl: entity.logoUrl ?? '', whatsApp: splitPhone(entity.whatsAppPhone), officeHours: entity.officeHours ?? '',

            fincaNumber: entity.fincaNumber ?? '', padronNumber: entity.padronNumber ?? '',
            cadastralAccount: entity.cadastralAccount ?? '',
            legalEntityNumber: entity.legalEntityNumber ?? '', legalEntityDate: entity.legalEntityDate ?? '',
            bylaws: templateFile(entity.bylawsUrl, entity.bylawsFileName),
            administratorName: entity.administratorName ?? '', administratorPhone: splitPhone(entity.administratorPhone),
            emergencyContactName: entity.emergencyContactName ?? '', emergencyContactPhone: splitPhone(entity.emergencyContactPhone),

            ruc: entity.ruc ?? '', legalName: entity.legalName ?? '',
            taxpayerType: entity.taxpayerType ?? null, vatRegime: entity.vatRegime ?? null,
            economicActivity: entity.economicActivity ?? '', fiscalAddress: entity.fiscalAddress ?? '',
            invoiceEmail: entity.invoiceEmail ?? '',

            defaultDueDay: entity.defaultDueDay ?? null, graceDays: entity.graceDays ?? null,
            paymentInstructions: entity.paymentInstructions ?? '',
            bankAccounts: (entity.bankAccounts ?? []).map(a => ({
              key: ++this.bankKeySeq, id: a.id ?? null, bankName: a.bankName, accountType: a.accountType,
              accountNumber: a.accountNumber, holderName: a.holderName,
              holderDocument: a.holderDocument ?? '', alias: a.alias ?? '', isActive: a.isActive
            })),

            timeZoneId: entity.timeZoneId ?? 'America/Asuncion'
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

  selectTab(key: TabKey): void {
    this.activeTab = key;
    if (this.errorTab === key) this.errorTab = null;
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

  trackBank(_: number, a: BankAccountForm): number { return a.key; }

  addBankAccount(): void {
    if (this.form.bankAccounts.length >= this.maxBankAccounts) return;
    this.form.bankAccounts.push({
      key: ++this.bankKeySeq, id: null, bankName: '', accountType: 'Checking', accountNumber: '',
      holderName: this.form.legalName, holderDocument: this.form.ruc, alias: '', isActive: true
    });
  }

  removeBankAccount(index: number): void { this.form.bankAccounts.splice(index, 1); }

  private async uploadImageOrFile(file: File, convertPdf: boolean): Promise<{ url: string } | null> {
    if (file.size > 10 * 1024 * 1024) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El archivo supera el límite de 10 MB.', life: 5000 });
      return null;
    }

    // El PDF de un modelo se usa como fondo de la factura/NC/liquidacion real: eso solo puede incrustar imagenes
    // rasterizadas, asi que si suben un PDF se convierte a PNG en el navegador antes de subirlo.
    let toUpload = file;
    if (convertPdf && isPdfFile(file)) {
      try {
        toUpload = await pdfFirstPageToPngFile(file);
      } catch {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo convertir el PDF a imagen. Probá subir una foto o captura del papel en su lugar.', life: 6000 });
        return null;
      }
    }

    return new Promise(resolve => {
      this.uploadsApi.upload(toUpload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ url }) => resolve({ url }),
        error: err => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo subir el archivo.'), life: 5000 });
          resolve(null);
        }
      });
    });
  }

  async onTemplateSelected(kind: TemplateKind, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadingTemplate = kind;
    this.cdr.markForCheck();
    const uploaded = await this.uploadImageOrFile(file, true);
    if (uploaded) this.form.templates[kind] = { url: uploaded.url, fileName: file.name };
    this.uploadingTemplate = null;
    this.cdr.markForCheck();
  }

  async onLogoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadingLogo = true;
    this.cdr.markForCheck();
    const uploaded = await this.uploadImageOrFile(file, false);
    if (uploaded) this.form.logoUrl = uploaded.url;
    this.uploadingLogo = false;
    this.cdr.markForCheck();
  }

  async onBylawsSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadingBylaws = true;
    this.cdr.markForCheck();
    const uploaded = await this.uploadImageOrFile(file, false);
    if (uploaded) this.form.bylaws = { url: uploaded.url, fileName: file.name };
    this.uploadingBylaws = false;
    this.cdr.markForCheck();
  }

  removeTemplate(kind: TemplateKind): void { this.form.templates[kind] = null; }

  onCodeInput()  { this.form.code = this.form.code.toUpperCase().replace(/[^A-Z0-9-]/g, ''); }
  onPhoneInput() { this.form.phoneNumber = this.form.phoneNumber.replace(/\D/g, ''); this.phoneError = ''; }
  onOptionalPhoneInput(phone: PhoneInput) {
    phone.number = phone.number.replace(/\D/g, '');
    this.phoneErrors = {};
  }
  onEmailInput() { this.emailError = ''; }
  cancel()       { this.router.navigate(['/buildings']); }

  // Muestra el error en un aviso y lleva a la pestaña donde está, marcándola.
  private fail(tab: TabKey, detail: string): void {
    this.activeTab = tab;
    this.errorTab = tab;
    if (detail) this.msg.add({ severity: 'error', summary: 'Error', detail, life: 5000 });
    this.cdr.markForCheck();
  }

  save(): void {
    this.phoneError = ''; this.emailError = ''; this.rucError = ''; this.phoneErrors = {}; this.errorTab = null;
    const companyId     = this.form.companyId || null;
    const condominiumId = this.form.condominiumId || null;
    const name          = this.form.name.trim();
    const code          = this.form.code.trim().toUpperCase();
    const address       = this.form.address.trim();
    const description   = this.form.description.trim() || null;
    const phonePrefix   = this.form.phonePrefix || null;
    const phoneNumber   = this.form.phoneNumber.trim() || null;
    const email         = this.form.email.trim().toLowerCase() || null;

    if (this.isSuperAdmin && !this.isEditing && !companyId) { this.fail('general', 'La empresa es obligatoria.'); return; }
    if (!name)    { this.fail('general', 'El nombre es obligatorio.'); return; }
    if (!code)    { this.fail('general', 'El código es obligatorio.'); return; }
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) { this.fail('general', 'Código inválido: solo letras mayúsculas, números y guiones.'); return; }
    if (!address) { this.fail('general', 'La dirección es obligatoria.'); return; }
    if (phoneNumber) {
      const p = PHONE_PREFIXES.find(x => x.value === phonePrefix);
      if (p && !p.pattern.test(phoneNumber)) { this.phoneError = `Formato inválido para ${p.label}: ${p.hint}.`; this.fail('general', ''); return; }
    }
    if (email && !/^[^\s@]+@gmail\.com$/i.test(email)) { this.emailError = 'Por ahora solo se aceptan correos @gmail.com.'; this.fail('general', ''); return; }

    const lat = numOrNull(this.form.latitude);
    const lng = numOrNull(this.form.longitude);
    if ((lat === null) !== (lng === null)) { this.fail('general', 'Cargá la latitud y la longitud juntas, o dejá las dos vacías.'); return; }
    if (lat !== null && (lat < -90 || lat > 90)) { this.fail('general', 'La latitud debe estar entre -90 y 90.'); return; }
    if (lng !== null && (lng < -180 || lng > 180)) { this.fail('general', 'La longitud debe estar entre -180 y 180.'); return; }

    for (const [key, phone, label, tab] of [
      ['whatsApp', this.form.whatsApp, 'WhatsApp', 'general'],
      ['adminPhone', this.form.administratorPhone, 'Teléfono del administrador', 'legal'],
      ['emergencyPhone', this.form.emergencyContactPhone, 'Teléfono de emergencia', 'legal']
    ] as [string, PhoneInput, string, TabKey][]) {
      const problem = phoneProblem(phone, label);
      if (problem) { this.phoneErrors = { [key]: problem }; this.fail(tab, ''); return; }
    }

    // Datos fiscales: solo los edita quien administra. El RUC se valida solo si lo cambiaron (igual que el backend).
    const ruc = this.form.ruc.trim();
    if (!this.isBuildingManager) {
      if (ruc && ruc !== this.originalRuc.trim() && !isValidRuc(ruc)) {
        this.rucError = 'RUC no válido: usá el formato 80012345-0 con su dígito verificador correcto.';
        this.fail('billing', '');
        return;
      }
      const invoiceEmail = this.form.invoiceEmail.trim();
      if (invoiceEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceEmail)) { this.fail('billing', 'El email para comprobantes no es válido.'); return; }

      const dueDay = numOrNull(this.form.defaultDueDay);
      if (dueDay !== null && (dueDay < 1 || dueDay > 31)) { this.fail('accounting', 'El día de vencimiento debe estar entre 1 y 31.'); return; }
      const grace = numOrNull(this.form.graceDays);
      if (grace !== null && (grace < 0 || grace > 365)) { this.fail('accounting', 'Los días de gracia deben estar entre 0 y 365.'); return; }

      for (let i = 0; i < this.form.bankAccounts.length; i++) {
        const a = this.form.bankAccounts[i];
        if (!a.bankName.trim() || !a.accountNumber.trim() || !a.holderName.trim()) {
          this.fail('accounting', `Cuenta bancaria ${i + 1}: completá el banco, el número de cuenta y el titular.`);
          return;
        }
      }
    }

    const lateFeeRate = this.form.lateFeeRatePercentage || null;
    const lateFeeFrequency = (lateFeeRate && this.form.lateFeeFrequency) ? this.form.lateFeeFrequency : null;
    if (lateFeeRate && !lateFeeFrequency) { this.fail('accounting', 'Definí el incremento de la mora (diario, semanal o quincenal).'); return; }

    // Solo el SuperAdmin configura el modo de facturación; es obligatorio para el, el resto no lo envia.
    if (this.isSuperAdmin && !this.form.invoicingMode) {
      this.fail('billing', 'El modo de facturación es obligatorio.');
      return;
    }

    // Solo el SuperAdmin edita los modelos; el resto no los envia y el backend los deja como estan.
    const standard = this.form.useStandardTemplates;
    const { invoice, creditNote, settlement } = this.form.templates;
    if (this.isSuperAdmin && !standard && (!invoice || !creditNote || !settlement)) {
      this.fail('billing', 'Adjuntá los 3 modelos (factura, nota de crédito y liquidación) o marcá "Usar modelos estándar de CONDOPY".');
      return;
    }

    const req = { companyId, condominiumId, name, code, address, isActive: this.form.isActive, description, contactPhonePrefix: phonePrefix, contactPhone: phoneNumber, contactEmail: email,
                  lateFeeRatePercentage: lateFeeRate, lateFeeFrequency,
                  incomeTreatment: this.form.incomeTreatment,
                  reserveFundPercentage: this.form.reserveFundPercentage || null,
                  extraordinaryPercentage: this.form.extraordinaryPercentage || null,
                  blockOverdueAmenityReservations: this.form.blockOverdueAmenityReservations,

                  // Ficha de registro
                  propertyType: this.form.propertyType,
                  department: nullIfBlank(this.form.department), city: nullIfBlank(this.form.city),
                  neighborhood: nullIfBlank(this.form.neighborhood), locationReference: nullIfBlank(this.form.locationReference),
                  latitude: lat, longitude: lng,
                  yearBuilt: numOrNull(this.form.yearBuilt), towersCount: numOrNull(this.form.towersCount),
                  floorsCount: numOrNull(this.form.floorsCount), unitsCount: numOrNull(this.form.unitsCount),
                  logoUrl: nullIfBlank(this.form.logoUrl), whatsAppPhone: joinPhone(this.form.whatsApp),
                  officeHours: nullIfBlank(this.form.officeHours),
                  fincaNumber: nullIfBlank(this.form.fincaNumber), padronNumber: nullIfBlank(this.form.padronNumber),
                  cadastralAccount: nullIfBlank(this.form.cadastralAccount),
                  legalEntityNumber: nullIfBlank(this.form.legalEntityNumber), legalEntityDate: nullIfBlank(this.form.legalEntityDate),
                  bylawsUrl: this.form.bylaws?.url ?? null, bylawsFileName: this.form.bylaws?.fileName ?? null,
                  administratorName: nullIfBlank(this.form.administratorName), administratorPhone: joinPhone(this.form.administratorPhone),
                  emergencyContactName: nullIfBlank(this.form.emergencyContactName), emergencyContactPhone: joinPhone(this.form.emergencyContactPhone),
                  timeZoneId: nullIfBlank(this.form.timeZoneId),
                  ...(!this.isBuildingManager ? {
                    ruc: nullIfBlank(ruc), legalName: nullIfBlank(this.form.legalName),
                    taxpayerType: this.form.taxpayerType, vatRegime: this.form.vatRegime,
                    economicActivity: nullIfBlank(this.form.economicActivity), fiscalAddress: nullIfBlank(this.form.fiscalAddress),
                    invoiceEmail: nullIfBlank(this.form.invoiceEmail),
                    defaultDueDay: numOrNull(this.form.defaultDueDay), graceDays: numOrNull(this.form.graceDays),
                    paymentInstructions: nullIfBlank(this.form.paymentInstructions),
                    bankAccounts: this.form.bankAccounts.map(a => ({
                      id: a.id, bankName: a.bankName.trim(), accountType: a.accountType, accountNumber: a.accountNumber.trim(),
                      holderName: a.holderName.trim(), holderDocument: nullIfBlank(a.holderDocument), alias: nullIfBlank(a.alias),
                      isActive: a.isActive
                    }))
                  } : {}),
                  ...(this.isSuperAdmin ? {
                    invoicingMode: this.form.invoicingMode || null,
                    useStandardTemplates: standard,
                    invoiceTemplateUrl:         standard ? null : invoice!.url,
                    invoiceTemplateFileName:    standard ? null : invoice!.fileName,
                    creditNoteTemplateUrl:      standard ? null : creditNote!.url,
                    creditNoteTemplateFileName: standard ? null : creditNote!.fileName,
                    settlementTemplateUrl:      standard ? null : settlement!.url,
                    settlementTemplateFileName: standard ? null : settlement!.fileName
                  } : {}) };
    this.isSaving = true;
    const op = this.isEditing ? this.api.update(this.editingId, req) : this.api.create(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.isSaving = false; this.router.navigate(['/buildings']); },
      error: err => { this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar.'), life: 5000 }); this.isSaving = false; this.cdr.markForCheck(); }
    });
  }
}
