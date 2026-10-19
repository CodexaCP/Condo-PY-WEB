import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingConfigApiService } from '../../api/building-config-api.service';
import { AccountingBookDefaults, AccountingBookHolder, AccountingBooks } from '../../api/building-config.models';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

const MAX_FOLIOS = 100000;

// Libros contables del edificio: quién es el titular del libro (el consorcio o la empresa administradora), sus datos para el encabezado del
// Libro Diario, el contador y los datos de la rúbrica del Registro Público de Comercio. El Diario es uno por edificio aunque el titular sea la
// administradora. Es solo información: no asienta nada ni cambia saldos. La rúbrica es un trámite externo, acá solo se anotan sus datos.
@Component({
  standalone: true,
  selector: 'app-config-books-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Message],
  template: `
    <h2>Libros contables</h2>
    <p class="muted small">Titular del libro, contador y rúbrica. Estos datos salen en el encabezado del Libro Diario del edificio.</p>

    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <p class="app-state" *ngIf="loading">Cargando...</p>

    <ng-container *ngIf="books as b">
      <p-message *ngIf="!b.financeAvailable" severity="info"
                 text="El módulo Finanzas del edificio no está disponible en este edificio, así que los libros contables no se pueden configurar."></p-message>

      <ng-container *ngIf="b.financeAvailable">
        <div class="notice" *ngIf="!b.configured">
          Todavía no se configuró el titular. Mientras tanto rige <strong>el consorcio</strong> con los datos de la ficha del edificio.
        </div>

        <form class="form" (ngSubmit)="save()">
          <label class="field wide">
            <span>Titular del libro</span>
            <select name="holder" [(ngModel)]="form.holder" [disabled]="!b.canEdit">
              <option *ngFor="let o of holderOptions" [ngValue]="o.value">{{ o.label }}</option>
            </select>
            <span class="hint">El libro es siempre uno por edificio; el titular solo cambia el encabezado.</span>
          </label>

          <label class="field wide">
            <span>Razón social</span>
            <input type="text" name="legalName" maxlength="200" [(ngModel)]="form.holderLegalName" [placeholder]="defaults(b).legalName || 'Sin dato'" [disabled]="!b.canEdit" />
          </label>
          <label class="field">
            <span>RUC</span>
            <input type="text" name="ruc" maxlength="20" [(ngModel)]="form.holderRuc" [placeholder]="defaults(b).ruc || 'Ej. 80012345-0'" [disabled]="!b.canEdit" />
            <span class="hint" *ngIf="form.holder === 'AdminCompany' && !defaults(b).ruc">La empresa no tiene RUC cargado en el sistema: cargalo acá.</span>
          </label>
          <label class="field">
            <span>Domicilio</span>
            <input type="text" name="address" maxlength="300" [(ngModel)]="form.holderAddress" [placeholder]="defaults(b).address || 'Sin dato'" [disabled]="!b.canEdit" />
          </label>
          <p class="muted small wide-note">Lo que dejes vacío se completa con el dato por defecto del titular (se ve en gris).</p>

          <label class="field">
            <span>Contador</span>
            <input type="text" name="accountant" maxlength="200" [(ngModel)]="form.accountantName" [disabled]="!b.canEdit" />
          </label>
          <label class="field">
            <span>Matrícula del contador</span>
            <input type="text" name="registration" maxlength="30" [(ngModel)]="form.accountantRegistration" [disabled]="!b.canEdit" />
          </label>

          <h3 class="wide-title">Rúbrica (Registro Público de Comercio)</h3>
          <label class="field">
            <span>Número de libro</span>
            <input type="text" name="bookNumber" maxlength="30" [(ngModel)]="form.bookNumber" [disabled]="!b.canEdit" />
          </label>
          <label class="field">
            <span>Fecha de rúbrica</span>
            <input type="date" name="rubricDate" [(ngModel)]="form.rubricDate" [disabled]="!b.canEdit" />
          </label>
          <label class="field">
            <span>Folios autorizados</span>
            <input type="number" name="authorized" min="0" [max]="maxFolios" step="1" [(ngModel)]="form.authorizedFolios" [disabled]="!b.canEdit" />
          </label>
          <label class="field">
            <span>Folios usados</span>
            <input type="number" name="used" min="0" [max]="maxFolios" step="1" [(ngModel)]="form.usedFolios" [disabled]="!b.canEdit" />
          </label>

          <div class="notice info wide-note">
            <strong>Así saldría en el encabezado:</strong>
            {{ preview(b).legalName || 'Sin razón social' }} · RUC {{ preview(b).ruc || 'sin cargar' }} · {{ preview(b).address || 'sin domicilio' }}
          </div>

          <div class="actions wide-note" *ngIf="b.canEdit">
            <button type="submit" class="btn" [disabled]="saving">{{ saving ? 'Guardando...' : (b.configured ? 'Guardar cambios' : 'Guardar y configurar') }}</button>
          </div>
          <p class="muted small wide-note" *ngIf="!b.canEdit">Solo el SuperAdmin y el Administrador de empresa pueden editar los libros contables.</p>
        </form>

        <p class="muted small">La rúbrica es un trámite externo en el Registro Público de Comercio; acá solo se anotan sus datos. Cada cambio queda en el historial del Centro de configuración.</p>
      </ng-container>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .wide-note { grid-column: 1 / -1; margin: 0; }
    .wide-title { grid-column: 1 / -1; margin: 0.6rem 0 0; }
  `]
})
export class ConfigBooksSectionComponent implements OnChanges {
  private readonly api = inject(BuildingConfigApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) buildingId = '';

  readonly maxFolios = MAX_FOLIOS;
  readonly holderOptions: { value: AccountingBookHolder; label: string }[] = [
    { value: 'Consortium', label: 'El consorcio de propietarios (con su propio RUC)' },
    { value: 'AdminCompany', label: 'La empresa administradora' }
  ];

  books: AccountingBooks | null = null;
  form = {
    holder: 'Consortium' as AccountingBookHolder,
    holderLegalName: '',
    holderRuc: '',
    holderAddress: '',
    accountantName: '',
    accountantRegistration: '',
    bookNumber: '',
    rubricDate: '',
    authorizedFolios: null as number | null,
    usedFolios: null as number | null
  };
  loading = false;
  saving = false;
  error = '';

  ngOnChanges(): void {
    this.load();
  }

  // Dato por defecto del titular elegido en el formulario (sirve de ayuda en gris mientras el campo está vacío).
  defaults(b: AccountingBooks): AccountingBookDefaults {
    return this.form.holder === 'AdminCompany' ? b.adminCompanyDefaults : b.consortiumDefaults;
  }

  // Lo que saldría en el encabezado con lo que hay hoy en el formulario.
  preview(b: AccountingBooks): AccountingBookDefaults {
    const d = this.defaults(b);
    return {
      legalName: this.form.holderLegalName.trim() || d.legalName,
      ruc: this.form.holderRuc.trim() || d.ruc,
      address: this.form.holderAddress.trim() || d.address
    };
  }

  save(): void {
    const f = this.form;
    if (f.authorizedFolios !== null && (f.authorizedFolios < 0 || f.authorizedFolios > MAX_FOLIOS)) return this.warn(`Los folios autorizados deben estar entre 0 y ${MAX_FOLIOS}.`);
    if (f.usedFolios !== null && (f.usedFolios < 0 || f.usedFolios > MAX_FOLIOS)) return this.warn(`Los folios usados deben estar entre 0 y ${MAX_FOLIOS}.`);
    if (f.authorizedFolios !== null && f.usedFolios !== null && f.usedFolios > f.authorizedFolios) return this.warn('Los folios usados no pueden superar a los autorizados.');

    this.saving = true;
    this.api.updateBooks(this.buildingId, {
      holder: f.holder,
      holderLegalName: f.holderLegalName.trim() || null,
      holderRuc: f.holderRuc.trim() || null,
      holderAddress: f.holderAddress.trim() || null,
      accountantName: f.accountantName.trim() || null,
      accountantRegistration: f.accountantRegistration.trim() || null,
      bookNumber: f.bookNumber.trim() || null,
      rubricDate: f.rubricDate || null,
      authorizedFolios: f.authorizedFolios,
      usedFolios: f.usedFolios
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: books => {
        this.apply(books);
        this.saving = false;
        this.msg.add({ severity: 'success', summary: 'Libros contables guardados', life: 3500 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.msg.add({ severity: 'error', summary: 'No se pudo guardar', detail: extractApiErrorMessage(err, 'No se pudieron guardar los libros contables.'), life: 7000 });
        this.cdr.markForCheck();
      }
    });
  }

  private warn(detail: string): void {
    this.msg.add({ severity: 'warn', summary: 'Revisá los datos', detail, life: 5000 });
  }

  private apply(books: AccountingBooks): void {
    this.books = books;
    this.form = {
      holder: books.holder,
      holderLegalName: books.holderLegalName ?? '',
      holderRuc: books.holderRuc ?? '',
      holderAddress: books.holderAddress ?? '',
      accountantName: books.accountantName ?? '',
      accountantRegistration: books.accountantRegistration ?? '',
      bookNumber: books.bookNumber ?? '',
      rubricDate: books.rubricDate ?? '',
      authorizedFolios: books.authorizedFolios,
      usedFolios: books.usedFolios
    };
  }

  private load(): void {
    if (!this.buildingId) return;

    this.loading = true;
    this.error = '';
    this.api.getBooks(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: books => {
        this.apply(books);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.books = null;
        this.loading = false;
        this.error = extractApiErrorMessage(err, 'No se pudieron cargar los libros contables.');
        this.cdr.markForCheck();
      }
    });
  }
}
