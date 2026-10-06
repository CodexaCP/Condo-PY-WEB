import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { OwnerCreditBreakdown, OwnerCreditLot, OwnerCreditUse, OwnerEligibleBuilding, OwnerPresidentBuilding, PersonType } from '../../api/models';
import { OwnerPaymentsApiService } from '../../api/owner-payments-api.service';
import { OwnersApiService } from '../../api/owners-api.service';
import { UploadsApiService } from '../../api/uploads-api.service';
import { resolveUploadUrl } from '../../api/file-url.util';

interface PhonePrefix { label: string; value: string; flag: string; }
const PHONE_PREFIXES: PhonePrefix[] = [
  { label: 'PY +595', value: '+595', flag: '🇵🇾' },
  { label: 'USA +1',  value: '+1',   flag: '🇺🇸' },
  { label: 'BR +55',  value: '+55',  flag: '🇧🇷' },
  { label: 'ARG +54', value: '+54',  flag: '🇦🇷' },
  { label: 'VE +58',  value: '+58',  flag: '🇻🇪' },
];

@Component({
  standalone: true,
  selector: 'app-propietario-create-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Select, Tooltip],
  template: `
    <p-card styleClass="app-page-card">

      <!-- HEADER -->
      <div class="create-header">
        <button class="back-btn" (click)="cancel()" pTooltip="Volver al listado" tooltipPosition="right">
          <i class="pi pi-arrow-left"></i>
        </button>
        <div>
          <h1>{{ isEditing ? 'Editar propietario' : 'Nuevo propietario' }}</h1>
          <p>{{ isEditing ? editingFullName : 'Complete los datos para registrar la ficha del propietario.' }}</p>
        </div>
      </div>

      <p-message *ngIf="loadError" severity="error" [text]="loadError"></p-message>
      <div *ngIf="loading" class="app-state">Cargando datos...</div>

      <form class="create-form" (ngSubmit)="save()" *ngIf="!loading && !loadError">

        <!-- ══ DATOS PERSONALES ══════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Datos personales</h2>

          <div class="field-row">
            <div class="field">
              <label for="firstName">Nombre <span class="required">*</span></label>
              <input id="firstName" type="text" [(ngModel)]="form.firstName" name="firstName"
                     placeholder="Ej. Juan" maxlength="80" autocomplete="off" />
            </div>
            <div class="field">
              <label for="lastName">Apellidos <span class="required">*</span></label>
              <input id="lastName" type="text" [(ngModel)]="form.lastName" name="lastName"
                     placeholder="Ej. Pérez García" maxlength="100" autocomplete="off" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="personType">Tipo de persona</label>
              <select id="personType" [(ngModel)]="form.personType" name="personType">
                <option value="">— Sin especificar —</option>
                <option value="Natural">Persona física</option>
                <option value="Legal">Persona jurídica (empresa)</option>
              </select>
            </div>
            <div class="field" *ngIf="form.personType === 'Legal'">
              <label for="legalName">Razón social <span class="required">*</span></label>
              <input id="legalName" type="text" [(ngModel)]="form.legalName" name="legalName"
                     placeholder="Nombre legal de la empresa" maxlength="200" autocomplete="off" />
              <small class="field-hint">Con persona jurídica la factura sale a nombre de la razón social.</small>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="documentType">Tipo de documento</label>
              <select id="documentType" [(ngModel)]="form.documentType" name="documentType">
                <option value="">— Sin especificar —</option>
                <option value="CedulaParaguaya">Cédula paraguaya</option>
                <option value="RUC">RUC</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="DocumentoExtranjero">Documento extranjero</option>
              </select>
            </div>
            <div class="field">
              <label for="documentNumber">Número de documento</label>
              <input id="documentNumber" type="text" [(ngModel)]="form.documentNumber" name="documentNumber"
                     placeholder="Ej. 1234567 o AB-123456" maxlength="40" autocomplete="off" />
              <small class="field-hint">Cédula: solo números. RUC: formato 80012345-0. Otros: letras, números o guiones.</small>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="nationality">Nacionalidad <span class="optional">(opcional)</span></label>
              <input id="nationality" type="text" [(ngModel)]="form.nationality" name="nationality"
                     placeholder="Ej. Paraguaya" maxlength="60" autocomplete="off" />
            </div>
            <div class="field">
              <label for="birthDate">Fecha de nacimiento <span class="optional">(opcional)</span></label>
              <input id="birthDate" type="date" [(ngModel)]="form.birthDate" name="birthDate" />
            </div>
          </div>

          <div class="field">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.isResident" name="isResident" />
              <span>También es residente del edificio</span>
            </label>
            <small class="field-hint">
              Al activarlo se crea automáticamente su registro de residente en la unidad que posee
              (visible y editable desde Residentes) — cuenta en los contadores del dashboard. Al
              desactivarlo, esa residencia se finaliza.
            </small>
          </div>
        </section>

        <!-- ══ ACCESO AL SISTEMA ════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Acceso al sistema</h2>

          <div class="field-row">
            <div class="field">
              <label for="username">Nombre de usuario <span class="required">*</span></label>
              <input id="username" type="text" [(ngModel)]="form.username" name="username"
                     placeholder="ej. juan.perez" maxlength="60" autocomplete="off"
                     (input)="onUsernameInput()" />
              <small class="field-hint">Solo minúsculas, números, puntos y guiones.</small>
            </div>
            <div class="field">
              <label for="email">Correo electrónico <span class="required">*</span></label>
              <input id="email" type="email" [(ngModel)]="form.email" name="email"
                     placeholder="propietario@ejemplo.com" maxlength="160" autocomplete="off" />
            </div>
          </div>

          <div class="login-info-box">
            <div class="login-method">
              <i class="pi pi-at"></i>
              <span><strong>Correo</strong> propietario&#64;ejemplo.com</span>
            </div>
            <div class="login-sep">ó</div>
            <div class="login-method">
              <i class="pi pi-user"></i>
              <span><strong>Usuario</strong> juan.perez</span>
            </div>
            <p class="login-note" *ngIf="!isEditing">
              Clave inicial: <code>123456</code> — el propietario deberá cambiarla en su primer ingreso.
            </p>
          </div>

          <div class="field">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
              <span>Propietario activo</span>
            </label>
          </div>
        </section>

        <!-- ══ CONTACTO ══════════════════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Contacto</h2>

          <div class="field-row">
            <div class="field">
              <label>Teléfono <span class="optional">(opcional)</span></label>
              <div class="phone-row">
                <p-select [options]="prefixOptions" [(ngModel)]="form.phonePrefix" name="phonePrefix"
                          optionLabel="label" optionValue="value" styleClass="phone-prefix-select">
                  <ng-template pTemplate="selectedItem" let-item>
                    <span *ngIf="item">{{ item.flag }} {{ item.value }}</span>
                  </ng-template>
                  <ng-template pTemplate="item" let-item>
                    <span>{{ item.flag }} {{ item.label }}</span>
                  </ng-template>
                </p-select>
                <input type="tel" [(ngModel)]="form.phone" name="phone"
                       placeholder="0981 123 456" class="phone-input"
                       (input)="onPhoneInput()" maxlength="15" />
              </div>
            </div>
            <div class="field">
              <label for="address">Dirección <span class="optional">(opcional)</span></label>
              <input id="address" type="text" [(ngModel)]="form.address" name="address"
                     placeholder="Calle, número, ciudad" maxlength="200" autocomplete="off" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="secondaryPhone">Teléfono secundario <span class="optional">(opcional)</span></label>
              <input id="secondaryPhone" type="tel" [(ngModel)]="form.secondaryPhone" name="secondaryPhone"
                     placeholder="+595981123456" maxlength="20" autocomplete="off" (input)="onFullPhoneInput('secondaryPhone')" />
              <small class="field-hint">Con el prefijo del país.</small>
            </div>
            <div class="field">
              <label for="whatsAppPhone">WhatsApp <span class="optional">(opcional)</span></label>
              <input id="whatsAppPhone" type="tel" [(ngModel)]="form.whatsAppPhone" name="whatsAppPhone"
                     placeholder="+595981123456" maxlength="20" autocomplete="off" (input)="onFullPhoneInput('whatsAppPhone')" />
              <small class="field-hint">Con el prefijo del país. Para cobranza y avisos.</small>
            </div>
          </div>
        </section>

        <!-- ══ DATOS DE FACTURACIÓN ══════════════════════════════════ -->
        <section class="form-section">
          <h2 class="section-title">Datos de facturación</h2>
          <p class="section-desc">
            La factura se emite a quien figura como cliente. Normalmente son los datos personales (o la razón social si es una empresa).
            Si quiere que salga a nombre de otra persona o empresa, cárguelos acá: nombre y documento van juntos.
          </p>

          <div class="billing-preview">
            <i class="pi pi-receipt"></i>
            <span>La factura saldrá a nombre de: <strong>{{ billingPreviewName || '— (cargue los datos personales) —' }}</strong>
              <ng-container *ngIf="billingPreviewDoc"> · {{ billingPreviewDoc }}</ng-container></span>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="invoiceName">Nombre o razón social para la factura <span class="optional">(opcional)</span></label>
              <input id="invoiceName" type="text" [(ngModel)]="form.invoiceName" name="invoiceName"
                     placeholder="Solo si difiere de los datos personales" maxlength="200" autocomplete="off" />
            </div>
            <div class="field">
              <label for="invoiceEmail">Email para recibir la factura <span class="optional">(opcional)</span></label>
              <input id="invoiceEmail" type="email" [(ngModel)]="form.invoiceEmail" name="invoiceEmail"
                     placeholder="facturas@ejemplo.com" maxlength="160" autocomplete="off" />
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="invoiceDocumentType">Tipo de documento</label>
              <select id="invoiceDocumentType" [(ngModel)]="form.invoiceDocumentType" name="invoiceDocumentType">
                <option value="">— Sin especificar —</option>
                <option value="RUC">RUC</option>
                <option value="CedulaParaguaya">Cédula paraguaya</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="DocumentoExtranjero">Documento extranjero</option>
              </select>
            </div>
            <div class="field">
              <label for="invoiceDocument">Documento para la factura</label>
              <input id="invoiceDocument" type="text" [(ngModel)]="form.invoiceDocument" name="invoiceDocument"
                     placeholder="Ej. 80012345-0" maxlength="40" autocomplete="off" />
            </div>
          </div>

          <div class="field">
            <label for="invoiceAddress">Dirección para la factura <span class="optional">(opcional)</span></label>
            <input id="invoiceAddress" type="text" [(ngModel)]="form.invoiceAddress" name="invoiceAddress"
                   placeholder="Si se deja vacía, se usa la dirección del propietario" maxlength="300" autocomplete="off" />
          </div>
        </section>

        <!-- ══ SALDO A FAVOR ═════════════════════════════════════════ -->
        <section class="form-section" *ngIf="isEditing && credit">
          <h2 class="section-title">Saldo a favor</h2>
          <div class="credit-line">
            <button type="button" class="credit-link" *ngIf="credit.amount > 0 || credit.heldAmount > 0 || credit.uses.length"
                    (click)="creditVisible = true" pTooltip="Ver de dónde viene cada parte" tooltipPosition="top">
              {{ credit.amount | number:'1.0-0' }} Gs. <i class="pi pi-external-link"></i>
            </button>
            <span class="credit-none" *ngIf="!(credit.amount > 0 || credit.heldAmount > 0 || credit.uses.length)">Sin saldo a favor.</span>
            <small class="field-hint" *ngIf="credit.amount > 0">Toque el monto para ver el origen de cada parte.</small>
            <small class="field-hint" *ngIf="credit.heldAmount > 0">
              Además hay {{ credit.heldAmount | number:'1.0-0' }} Gs. retenidos (no cuentan en el saldo).
            </small>
          </div>
        </section>

        <!-- ══ PRESIDENTE DE CONSORCIO ═══════════════════════════════ -->
        <section class="form-section" *ngIf="isEditing">
          <h2 class="section-title">Presidente de consorcio</h2>

          <div class="field" *ngIf="!eligibleBuildings.length">
            <small class="field-hint">
              Para nombrarlo presidente, primero el propietario debe estar vinculado a una unidad de un edificio.
              Luego podrás marcarlo como presidente y cargar su firma.
            </small>
          </div>

          <div class="field" *ngIf="eligibleBuildings.length">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="isPresidentChecked" name="isPresidentChecked"
                     [ngModelOptions]="{standalone: true}" (ngModelChange)="onPresidentCheckboxChange()" />
              <span>Es presidente de consorcio</span>
            </label>
            <small class="field-hint">
              Único por edificio. Firma la liquidación de expensas antes de que se publique.
            </small>
          </div>

          <div class="field" *ngIf="isPresidentChecked">
            <label for="presidentBuildingId">Edificio</label>
            <select id="presidentBuildingId" [(ngModel)]="presidentBuildingId" name="presidentBuildingId"
                    [ngModelOptions]="{standalone: true}" (ngModelChange)="savePresidentBuilding()">
              <option [ngValue]="null" disabled>— Seleccionar —</option>
              <option *ngFor="let b of eligibleBuildings" [ngValue]="b.buildingId" [disabled]="b.hasOtherPresident">
                {{ b.buildingName }}{{ b.hasOtherPresident ? ' (ya tiene presidente: ' + b.otherPresidentName + ')' : '' }}
              </option>
            </select>
            <small class="field-hint" *ngIf="savingPresident"><i class="pi pi-spin pi-spinner"></i> Guardando...</small>
          </div>
        </section>

        <!-- ══ FIRMA DIGITAL ═════════════════════════════════════════ -->
        <section class="form-section" *ngIf="presidentOfBuildings.length">
          <h2 class="section-title">Firma digital</h2>
          <p class="section-desc">
            Imagen de la firma manuscrita, usada para firmar la liquidación de expensas como presidente del consorcio.
          </p>

          <div class="field">
            <label>Firma <span class="optional">(opcional)</span></label>
            <div class="signature-upload-row">
              <div class="signature-preview" *ngIf="form.signatureUrl">
                <img [src]="fileUrl(form.signatureUrl)" alt="Firma" />
              </div>
              <div class="signature-upload-area" (click)="signatureFileInput.click()">
                <i class="pi pi-pencil"></i>
                <span *ngIf="!uploadingSignature">
                  {{ form.signatureUrl ? 'Cambiar firma' : 'Subir imagen de la firma (JPG/PNG, máx 10 MB)' }}
                </span>
                <span *ngIf="uploadingSignature"><i class="pi pi-spin pi-spinner"></i> Subiendo...</span>
              </div>
              <button type="button" class="signature-remove-btn" *ngIf="form.signatureUrl"
                      (click)="removeSignature()" pTooltip="Quitar firma" tooltipPosition="top">
                <i class="pi pi-times"></i>
              </button>
              <input #signatureFileInput type="file" accept=".jpg,.jpeg,.png,.webp,.gif" style="display:none"
                     (change)="onSignatureFileChange($event)" />
            </div>
          </div>
        </section>

        <!-- ══ ACCIONES ══════════════════════════════════════════════ -->
        <section class="form-actions">
          <div class="form-actions-left">
            <p-button *ngIf="isEditing" type="button" label="Eliminar propietario"
                      severity="danger" [outlined]="true" [rounded]="true"
                      icon="pi pi-trash" (onClick)="askDelete()">
            </p-button>
          </div>
          <div class="form-actions-right">
            <p-button type="button" label="Cancelar" [text]="true" [rounded]="true"
                      severity="secondary" (onClick)="cancel()">
            </p-button>
            <p-button type="submit" [label]="isEditing ? 'Guardar cambios' : 'Crear propietario'"
                      [text]="true" [rounded]="true" [loading]="isSaving"
                      icon="pi pi-check">
            </p-button>
          </div>
        </section>

      </form>
    </p-card>

    <!-- DESGLOSE DEL SALDO A FAVOR -->
    <div class="ov-backdrop" *ngIf="creditVisible" (click)="creditVisible = false"></div>
    <div class="ov-panel-lg" *ngIf="creditVisible && credit" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Saldo a favor de {{ editingFullName }}</strong>
        <button class="ov-close" (click)="creditVisible = false">✕</button>
      </div>

      <div class="credit-total">
        <span>Saldo actual</span>
        <strong>{{ credit.amount | number:'1.0-0' }} Gs.</strong>
      </div>

      <h3 class="credit-sub">De dónde viene</h3>
      <div class="credit-table-wrap">
        <table class="credit-table" *ngIf="activeLots.length || credit.untracedAmount > 0; else noLots">
          <thead>
            <tr><th>Fecha</th><th>Origen</th><th>Detalle</th><th class="num">Original</th><th class="num">Disponible</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let lot of activeLots">
              <td>{{ lot.createdAtUtc | date:'dd/MM/yyyy' }}</td>
              <td>
                <a *ngIf="lot.origin === 'OwnerPayment' && lot.ownerPaymentId" class="credit-origin-link"
                   (click)="openOwnerPayment(lot.ownerPaymentId)">{{ originLabel(lot) }}</a>
                <span *ngIf="!(lot.origin === 'OwnerPayment' && lot.ownerPaymentId)">{{ originLabel(lot) }}</span>
                <small class="credit-ref" *ngIf="lot.reference">{{ lot.reference }}</small>
              </td>
              <td>
                {{ lot.description }}
                <small class="credit-ref" *ngIf="lot.buildingName">{{ lot.buildingName }}<ng-container *ngIf="lot.unitCode"> — unidad {{ lot.unitCode }}</ng-container></small>
              </td>
              <td class="num">{{ lot.originalAmount | number:'1.0-0' }}</td>
              <td class="num"><strong>{{ lot.remainingAmount | number:'1.0-0' }}</strong></td>
            </tr>
            <tr *ngIf="credit.untracedAmount > 0">
              <td>—</td>
              <td>Saldo a favor anterior</td>
              <td>Saldo anterior al registro del historial: no se conoce el comprobante de origen.</td>
              <td class="num">{{ credit.untracedAmount | number:'1.0-0' }}</td>
              <td class="num"><strong>{{ credit.untracedAmount | number:'1.0-0' }}</strong></td>
            </tr>
          </tbody>
        </table>
        <ng-template #noLots><p class="credit-empty">No hay saldo disponible.</p></ng-template>
      </div>

      <ng-container *ngIf="heldLots.length">
        <h3 class="credit-sub">Retenido (no cuenta en el saldo)</h3>
        <div class="credit-table-wrap">
          <table class="credit-table">
            <tbody>
              <tr *ngFor="let lot of heldLots">
                <td>{{ lot.createdAtUtc | date:'dd/MM/yyyy' }}</td>
                <td>{{ originLabel(lot) }}<small class="credit-ref" *ngIf="lot.reference">{{ lot.reference }}</small></td>
                <td>{{ lot.description }}</td>
                <td class="num"><strong>{{ lot.remainingAmount | number:'1.0-0' }}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>

      <ng-container *ngIf="credit.uses.length">
        <h3 class="credit-sub">Cómo se fue usando</h3>
        <div class="credit-table-wrap">
          <table class="credit-table">
            <thead>
              <tr><th>Fecha</th><th>Forma</th><th>Detalle</th><th class="num">Monto</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let use of credit.uses">
                <td>{{ use.createdAtUtc | date:'dd/MM/yyyy' }}</td>
                <td>{{ applyModeLabel(use.applyMode) }}</td>
                <td>
                  {{ use.description }}
                  <small class="credit-ref" *ngIf="use.sourceReference">Del saldo de {{ use.sourceReference }}</small>
                </td>
                <td class="num">{{ use.amount | number:'1.0-0' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>

      <div class="confirm-footer">
        <p-button label="Cerrar" severity="secondary" [outlined]="true" (onClick)="creditVisible = false"></p-button>
      </div>
    </div>

    <!-- CONFIRM ELIMINAR -->
    <div class="ov-backdrop" *ngIf="confirmVisible" (click)="cancelDelete()"></div>
    <div class="ov-panel-sm" *ngIf="confirmVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Confirmar eliminación</strong>
        <button class="ov-close" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">
        ¿Eliminar la ficha de <strong>{{ editingFullName }}</strong> de forma permanente?
        Esta acción no se puede deshacer.
      </p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar definitivamente" severity="danger"
                  [loading]="isDeleting" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .create-header { display:flex; align-items:flex-start; gap:1rem; margin-bottom:2rem; }
    .create-header h1 { margin:0 0 0.25rem; }
    .create-header p  { margin:0; color:var(--brand-muted); }
    .back-btn {
      background:none; border:1px solid rgba(19,133,182,0.2); border-radius:50%;
      width:40px; height:40px; display:grid; place-items:center; cursor:pointer;
      color:var(--brand-muted); transition:background 0.15s,color 0.15s; flex-shrink:0; margin-top:4px;
    }
    .back-btn:hover { background:rgba(19,133,182,0.08); color:var(--brand-blue); }

    .create-form { display:flex; flex-direction:column; gap:2.5rem; }
    .form-section { display:flex; flex-direction:column; gap:1.25rem; }
    .section-title {
      font-size:0.88rem; font-weight:700; text-transform:uppercase; letter-spacing:0.07em;
      color:var(--brand-muted); margin:0 0 0.1rem; padding-bottom:0.5rem;
      border-bottom:1px solid rgba(19,133,182,0.1);
    }

    .field { display:flex; flex-direction:column; gap:0.4rem; }
    .field label { font-weight:500; font-size:0.92rem; color:var(--brand-ink); }
    .field-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    .field input, .field select {
      width:100%; padding:0.6rem 0.85rem; border:1px solid rgba(19,133,182,0.25);
      border-radius:10px; font:inherit; font-size:0.95rem; color:var(--brand-ink);
      background:#fff; transition:border-color 0.15s,box-shadow 0.15s; box-sizing:border-box;
    }
    .field input:focus, .field select:focus {
      outline:none; border-color:var(--brand-blue);
      box-shadow:0 0 0 3px rgba(19,133,182,0.12);
    }
    .field-hint  { color:var(--brand-muted); font-size:0.8rem; line-height:1.4; }
    .required  { color:#e74c3c; font-weight:600; }
    .optional  { font-weight:400; font-size:0.82rem; color:var(--brand-muted); }
    .billing-preview { display:flex; align-items:center; gap:0.6rem; padding:0.65rem 0.9rem; border-radius:10px; background:rgba(19,133,182,0.06); border:1px solid rgba(19,133,182,0.15); font-size:0.9rem; color:var(--brand-ink); }
    .billing-preview i { color:var(--brand-blue); }
    .checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:500; }
    .checkbox-label input[type=checkbox] { width:16px; height:16px; cursor:pointer; accent-color:var(--brand-blue); }
    .section-desc { margin:0; color:var(--brand-muted); font-size:0.88rem; }

    .signature-upload-row { display:flex; align-items:center; gap:0.75rem; }
    .signature-preview {
      width:110px; height:64px; border-radius:10px; border:1px solid rgba(19,133,182,0.15);
      background:#fff; display:grid; place-items:center; flex-shrink:0; overflow:hidden;
    }
    .signature-preview img { max-width:100%; max-height:100%; object-fit:contain; }
    .signature-upload-area {
      flex:1; display:flex; align-items:center; gap:0.5rem; justify-content:center;
      padding:0.8rem 1rem; border:2px dashed rgba(19,133,182,0.3);
      border-radius:12px; cursor:pointer; font-size:0.88rem; color:var(--brand-muted);
      transition:border-color 0.15s, color 0.15s;
    }
    .signature-upload-area:hover { border-color:var(--brand-blue); color:var(--brand-blue); }
    .signature-remove-btn {
      background:none; border:1px solid rgba(231,76,60,0.3); border-radius:50%;
      width:36px; height:36px; display:grid; place-items:center; cursor:pointer;
      color:#e74c3c; flex-shrink:0; transition:background 0.15s;
    }
    .signature-remove-btn:hover { background:rgba(231,76,60,0.08); }

    .phone-row { display:flex; gap:0.6rem; align-items:stretch; }
    .phone-input { flex:1; padding:0.6rem 0.85rem; border:1px solid rgba(19,133,182,0.25);
      border-radius:10px; font:inherit; font-size:0.95rem; color:var(--brand-ink); background:#fff; }
    .phone-input:focus { outline:none; border-color:var(--brand-blue); box-shadow:0 0 0 3px rgba(19,133,182,0.12); }
    :host ::ng-deep .phone-prefix-select { width:145px; flex-shrink:0; }
    :host ::ng-deep .phone-prefix-select .p-select { border-radius:10px; border:1px solid rgba(19,133,182,0.25); height:100%; }

    .login-info-box {
      display:flex; align-items:center; flex-wrap:wrap; gap:0.75rem 1.25rem;
      padding:0.9rem 1.1rem; border-radius:14px;
      background:#f0f8ff; border:1px solid rgba(19,133,182,0.2);
    }
    .login-method { display:flex; align-items:center; gap:0.5rem; font-size:0.9rem; color:var(--brand-ink); }
    .login-method i { color:var(--brand-blue); font-size:1rem; }
    .login-sep { font-size:1.1rem; color:var(--brand-muted); font-weight:600; }
    .login-note { width:100%; margin:0; font-size:0.82rem; color:var(--brand-muted); }
    .login-note code { background:rgba(19,133,182,0.1); color:var(--brand-blue); padding:0.1rem 0.4rem; border-radius:6px; font-size:0.85rem; }

    .form-actions {
      display:flex; justify-content:space-between; align-items:center;
      padding-top:0.75rem; border-top:1px solid rgba(19,133,182,0.08);
    }
    .form-actions-right { display:flex; gap:0.75rem; }

    .ov-backdrop {
      position:fixed; inset:0; background:rgba(15,35,50,0.45);
      z-index:1000; backdrop-filter:blur(2px); animation:fadeIn 0.15s ease;
    }
    .ov-panel-sm {
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      width:min(420px, calc(100vw - 2rem)); background:#fff; border-radius:24px;
      z-index:1001; box-shadow:0 32px 80px rgba(15,40,60,0.28);
      padding:1.6rem; animation:slideUp 0.2s cubic-bezier(.4,0,.2,1);
    }
    .credit-line { display:flex; align-items:center; flex-wrap:wrap; gap:0.5rem 1rem; }
    .credit-link {
      background:none; border:none; padding:0; cursor:pointer; font:inherit; font-size:1.25rem; font-weight:700;
      color:var(--brand-blue); text-decoration:underline; display:inline-flex; align-items:center; gap:0.4rem;
    }
    .credit-link i { font-size:0.85rem; }
    .credit-none { color:var(--brand-muted); font-size:0.95rem; }

    .ov-panel-lg {
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      width:min(900px, calc(100vw - 2rem)); max-height:calc(100vh - 3rem); overflow-y:auto; background:#fff;
      border-radius:24px; z-index:1001; box-shadow:0 32px 80px rgba(15,40,60,0.28);
      padding:1.6rem; animation:slideUp 0.2s cubic-bezier(.4,0,.2,1);
    }
    .credit-total {
      display:flex; justify-content:space-between; align-items:center; padding:0.9rem 1.1rem;
      border-radius:14px; background:#f0f8ff; border:1px solid rgba(19,133,182,0.2); margin-bottom:1rem;
    }
    .credit-total strong { font-size:1.3rem; color:var(--brand-blue); }
    .credit-sub { font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--brand-muted); margin:1.2rem 0 0.5rem; }
    .credit-table-wrap { overflow-x:auto; }
    .credit-table { width:100%; border-collapse:collapse; font-size:0.88rem; }
    .credit-table th { text-align:left; font-weight:600; color:var(--brand-muted); padding:0.4rem 0.6rem; border-bottom:1px solid rgba(19,133,182,0.15); }
    .credit-table td { padding:0.5rem 0.6rem; border-bottom:1px solid rgba(19,133,182,0.08); vertical-align:top; }
    .credit-table .num { text-align:right; white-space:nowrap; }
    .credit-ref { display:block; color:var(--brand-muted); font-size:0.78rem; }
    .credit-origin-link { color:var(--brand-blue); cursor:pointer; text-decoration:underline; }
    .credit-empty { margin:0; color:var(--brand-muted); }

    @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
    @keyframes slideUp {
      from { opacity:0; transform:translate(-50%, calc(-50% + 16px)); }
      to   { opacity:1; transform:translate(-50%, -50%); }
    }
    .ov-header {
      display:flex; justify-content:space-between; align-items:center;
      margin-bottom:1.2rem; padding-bottom:1rem;
      border-bottom:1px solid rgba(19,133,182,0.1);
    }
    .ov-header strong { font-size:1.1rem; color:var(--brand-ink); }
    .ov-close {
      background:none; border:none; cursor:pointer; font-size:1.1rem;
      color:var(--brand-muted); width:32px; height:32px; border-radius:50%;
      display:grid; place-items:center; transition:background 0.15s;
    }
    .ov-close:hover { background:rgba(19,133,182,0.08); color:var(--brand-ink); }
    .confirm-text { margin:0 0 1.2rem; color:var(--brand-ink); line-height:1.6; }
    .confirm-footer { display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1rem; }
  `]
})
export class PropietarioCreatePageComponent implements OnInit {
  // El backend guarda los archivos subidos como ruta relativa (/uploads/x.jpg): hay que anteponer el origen de la API.
  readonly fileUrl = resolveUploadUrl;
  private readonly api        = inject(OwnersApiService);
  private readonly uploadsApi = inject(UploadsApiService);
  private readonly paymentsApi = inject(OwnerPaymentsApiService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr        = inject(ChangeDetectorRef);
  private readonly msg        = inject(MessageService);

  prefixOptions = PHONE_PREFIXES;

  isEditing      = false;
  editingId      = '';
  editingFullName = '';
  loading        = true;
  loadError      = '';
  isSaving       = false;
  isDeleting     = false;
  confirmVisible = false;
  uploadingSignature = false;

  eligibleBuildings: OwnerEligibleBuilding[] = [];
  presidentOfBuildings: OwnerPresidentBuilding[] = [];
  isPresidentChecked = false;
  presidentBuildingId: string | null = null;
  savingPresident = false;

  credit: OwnerCreditBreakdown | null = null;
  creditVisible = false;

  form = this.emptyForm();

  get activeLots(): OwnerCreditLot[] { return (this.credit?.lots ?? []).filter(l => !l.onHold && l.remainingAmount > 0); }
  get heldLots(): OwnerCreditLot[]   { return (this.credit?.lots ?? []).filter(l => l.onHold && l.remainingAmount > 0); }

  originLabel(lot: OwnerCreditLot): string {
    switch (lot.origin) {
      case 'OwnerPayment':       return 'Comprobante de pago';
      case 'Marketplace':        return 'Reserva del Marketplace';
      case 'CreditNote':         return 'Nota de crédito';
      case 'SupplierCreditNote': return 'Nota de crédito del proveedor';
      default:                   return 'Saldo a favor anterior';
    }
  }

  applyModeLabel(mode: OwnerCreditUse['applyMode']): string {
    switch (mode) {
      case 'Automatic':         return 'Automático al publicar el período';
      case 'ManualApp':         return 'Aplicado por el propietario';
      case 'ManualManager':     return 'Aplicado por el administrador';
      case 'OnPaymentApproval': return 'Con un pago aprobado';
      default:                  return '—';
    }
  }

  openOwnerPayment(id: string): void {
    this.router.navigate(['/owner-payments', id]);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.loading = false;
      return;
    }

    this.api.getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: owner => {
          this.isEditing       = true;
          this.editingId       = id;
          this.editingFullName = owner.fullName
            || `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim();

          this.form = {
            firstName:      owner.firstName?.trim()  || '',
            lastName:       owner.lastName?.trim()   || '',
            username:       owner.username?.trim()   || '',
            email:          owner.email?.trim()      || '',
            documentType:   owner.documentType       || '',
            documentNumber: owner.documentNumber     || '',
            phonePrefix:    owner.phonePrefix        || '+595',
            phone:          owner.phone              || '',
            address:        owner.address            || '',
            isResident:     owner.isResident         ?? false,
            isActive:       owner.isActive           ?? true,
            signatureUrl:   owner.signatureUrl        || '',
            personType:     owner.personType          ?? '',
            legalName:      owner.legalName           || '',
            invoiceName:    owner.invoiceName         || '',
            invoiceDocumentType: owner.invoiceDocumentType || '',
            invoiceDocument: owner.invoiceDocument    || '',
            invoiceAddress: owner.invoiceAddress      || '',
            invoiceEmail:   owner.invoiceEmail        || '',
            secondaryPhone: owner.secondaryPhone      || '',
            whatsAppPhone:  owner.whatsAppPhone       || '',
            nationality:    owner.nationality         || '',
            birthDate:      owner.birthDate           || ''
          };

          this.presidentOfBuildings = owner.presidentOfBuildings || [];
          this.isPresidentChecked   = this.presidentOfBuildings.length > 0;
          this.presidentBuildingId  = this.presidentOfBuildings[0]?.buildingId ?? null;

          this.loading = false;
          this.cdr.markForCheck();

          // Si el usuario no tiene alcance sobre el propietario el servidor responde 404: la seccion simplemente no aparece.
          this.paymentsApi.getOwnerCreditBreakdown(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: credit => { this.credit = credit; this.cdr.markForCheck(); },
              error: () => { this.credit = null; this.cdr.markForCheck(); }
            });

          this.api.getEligiblePresidentBuildings(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: buildings => {
                this.eligibleBuildings = buildings;
                this.cdr.markForCheck();
              }
            });
        },
        error: () => {
          this.loadError = 'No se encontró el propietario solicitado.';
          this.loading   = false;
          this.cdr.markForCheck();
        }
      });
  }

  onUsernameInput(): void {
    this.form.username = this.form.username
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]/g, '');
  }

  onPhoneInput(): void {
    this.form.phone = this.form.phone.replace(/[^\d\s\-]/g, '');
  }

  // Teléfonos completos con prefijo (+595981123456): solo el + inicial, dígitos y separadores.
  onFullPhoneInput(field: 'secondaryPhone' | 'whatsAppPhone'): void {
    this.form[field] = this.form[field].replace(/[^\d+\s\-]/g, '');
  }

  // A quién saldría la factura con lo cargado (los datos de facturación propios; si no, la razón social o el nombre).
  get billingPreviewName(): string {
    const f = this.form;
    if (f.invoiceName.trim() && f.invoiceDocument.trim()) return f.invoiceName.trim();
    if (f.personType === 'Legal' && f.legalName.trim()) return f.legalName.trim();
    return `${f.firstName} ${f.lastName}`.trim();
  }

  get billingPreviewDoc(): string {
    const f = this.form;
    return (f.invoiceName.trim() && f.invoiceDocument.trim()) ? f.invoiceDocument.trim() : f.documentNumber.trim();
  }

  save(): void {
    const firstName = this.form.firstName.trim();
    const lastName  = this.form.lastName.trim();
    const username  = this.form.username.trim();
    const email     = this.form.email.trim().toLowerCase();

    if (!firstName) { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre es obligatorio.', life: 5000 }); return; }
    if (!lastName)  { this.msg.add({ severity: 'error', summary: 'Error', detail: 'Los apellidos son obligatorios.', life: 5000 }); return; }
    if (!username)  { this.msg.add({ severity: 'error', summary: 'Error', detail: 'El nombre de usuario es obligatorio.', life: 5000 }); return; }
    if (!/^[a-z0-9][a-z0-9.\-_]*$/.test(username)) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Nombre de usuario inválido. Solo minúsculas, números, puntos y guiones.', life: 5000 }); return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Correo electrónico inválido.', life: 5000 }); return;
    }
    if (this.form.personType === 'Legal' && !this.form.legalName.trim()) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La razón social es obligatoria para una persona jurídica.', life: 5000 }); return;
    }
    if (!!this.form.invoiceName.trim() !== !!this.form.invoiceDocument.trim()) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'Para facturar a otro nombre completá el nombre y el documento de facturación (o dejá los dos vacíos).', life: 5000 }); return;
    }

    const req = {
      firstName, lastName,
      fullName: `${firstName} ${lastName}`,
      username, email,
      documentType:   this.form.documentType   || null,
      documentNumber: this.form.documentNumber.trim() || null,
      phonePrefix:    this.form.phonePrefix    || null,
      phone:          this.form.phone.trim()   || null,
      address:        this.form.address.trim() || null,
      isResident:     this.form.isResident,
      isActive:       this.form.isActive,
      signatureUrl:   this.presidentOfBuildings.length ? (this.form.signatureUrl || null) : null,
      personType:     this.form.personType || null,
      legalName:      this.form.legalName.trim() || null,
      invoiceName:    this.form.invoiceName.trim() || null,
      invoiceDocumentType: this.form.invoiceDocumentType || null,
      invoiceDocument: this.form.invoiceDocument.trim() || null,
      invoiceAddress: this.form.invoiceAddress.trim() || null,
      invoiceEmail:   this.form.invoiceEmail.trim() || null,
      secondaryPhone: this.form.secondaryPhone.trim() || null,
      whatsAppPhone:  this.form.whatsAppPhone.trim() || null,
      nationality:    this.form.nationality.trim() || null,
      birthDate:      this.form.birthDate || null,
      password:       this.isEditing ? undefined : '123456'
    };

    this.isSaving = true;
    const op = this.isEditing
      ? this.api.update(this.editingId, req)
      : this.api.create(req);

    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.isSaving        = false;
        this.editingFullName = saved.fullName || `${saved.firstName} ${saved.lastName}`;
        if (!this.isEditing) {
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Propietario creado. Clave inicial: 123456', life: 4000 });
          this.router.navigate(['/propietarios']);
        } else {
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Cambios guardados correctamente.', life: 4000 });
          this.router.navigate(['/propietarios']);
        }
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar el propietario.'), life: 5000 });
        this.isSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  askDelete():    void { this.confirmVisible = true; }
  cancelDelete(): void { this.confirmVisible = false; }

  confirmDelete(): void {
    this.isDeleting = true;
    this.api.delete(this.editingId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isDeleting     = false;
          this.confirmVisible = false;
          this.router.navigate(['/propietarios']);
        },
        error: err => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo eliminar el propietario.'), life: 5000 });
          this.isDeleting = false;
          this.cdr.markForCheck();
        }
      });
  }

  cancel(): void { this.router.navigate(['/propietarios']); }

  private emptyForm() {
    return {
      firstName:      '',
      lastName:       '',
      username:       '',
      email:          '',
      documentType:   '',
      documentNumber: '',
      phonePrefix:    '+595',
      phone:          '',
      address:        '',
      isResident:     false,
      isActive:       true,
      signatureUrl:   '',
      personType:     '' as '' | PersonType,
      legalName:      '',
      invoiceName:    '',
      invoiceDocumentType: '',
      invoiceDocument: '',
      invoiceAddress: '',
      invoiceEmail:   '',
      secondaryPhone: '',
      whatsAppPhone:  '',
      nationality:    '',
      birthDate:      ''
    };
  }

  onPresidentCheckboxChange(): void {
    if (!this.isPresidentChecked) {
      this.savePresidentBuilding(null);
      return;
    }
    if (this.presidentBuildingId) {
      this.savePresidentBuilding();
    }
  }

  savePresidentBuilding(explicitBuildingId?: string | null): void {
    const buildingId = explicitBuildingId !== undefined ? explicitBuildingId : this.presidentBuildingId;

    this.savingPresident = true;
    this.api.setPresidentBuilding(this.editingId, buildingId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: owner => {
          this.presidentOfBuildings = owner.presidentOfBuildings || [];
          this.isPresidentChecked   = this.presidentOfBuildings.length > 0;
          this.presidentBuildingId  = this.presidentOfBuildings[0]?.buildingId ?? null;
          if (!this.isPresidentChecked) {
            this.form.signatureUrl = '';
          }
          this.savingPresident = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Presidencia actualizada.', life: 3000 });
          this.cdr.markForCheck();
        },
        error: err => {
          // Revertimos la selección visual al estado real, ya guardado en el servidor.
          this.presidentBuildingId = this.presidentOfBuildings[0]?.buildingId ?? null;
          this.isPresidentChecked  = this.presidentOfBuildings.length > 0;
          this.savingPresident = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo actualizar la presidencia.'), life: 6000 });
          this.cdr.markForCheck();
        }
      });
  }

  onSignatureFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'La imagen supera el límite de 10 MB.', life: 5000 });
      return;
    }

    this.uploadingSignature = true;
    this.cdr.markForCheck();
    this.uploadsApi.upload(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ url }) => {
        this.form.signatureUrl = url;
        this.uploadingSignature = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo subir la imagen.'), life: 5000 });
        this.uploadingSignature = false;
        this.cdr.markForCheck();
      }
    });
  }

  removeSignature(): void {
    this.form.signatureUrl = '';
  }
}
