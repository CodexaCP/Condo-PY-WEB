import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { isPdfUrl, resolveUploadUrl } from '../../api/file-url.util';
import { isPdfFile, pdfFirstPageToPngFile } from '../../api/pdf-to-image.util';
import { InvoiceSeriesApiService } from '../../api/invoice-series-api.service';
import { UploadsApiService } from '../../api/uploads-api.service';
import { AuthService } from '../../auth/auth.service';
import { FieldOffset, InvoiceSeries } from '../../api/models';

interface CalibField {
  key: string;
  label: string;
  sample: string;
  x: number; // punto PDF, origen abajo-izquierda (igual que InvoicePdfDocument)
  y: number;
  defaultFontSize: number; // debe coincidir con el tamano por defecto en InvoicePdfDocument.cs
}

// Mismas keys, coordenadas y tamanos base que usa InvoicePdfDocument.cs — si se agrega un campo
// calibrable ahi, hay que agregarlo aca tambien para poder arrastrarlo.
const FIELDS: CalibField[] = [
  { key: 'headerEdificio', label: 'Edificio', sample: 'EDIFICIO DE EJEMPLO', x: 48, y: 758, defaultFontSize: 15 },
  { key: 'headerEmisor', label: 'Razón social / dirección / tel.', sample: 'RAZÓN SOCIAL — Dirección — Tel.', x: 182, y: 784, defaultFontSize: 10 },
  { key: 'headerTimbradoNumero', label: 'N° de timbrado', sample: 'TIMBRADO N°12345678', x: 362.8346, y: 795, defaultFontSize: 9.5 },
  { key: 'vigenciaDesde', label: 'Vigencia desde', sample: 'Fecha Inicio Vigencia:01/01/2026', x: 362.8346, y: 783, defaultFontSize: 7.5 },
  { key: 'vigenciaHasta', label: 'Vigencia hasta', sample: 'Fecha Fin Vigencia:01/01/2027', x: 362.8346, y: 773, defaultFontSize: 7.5 },
  { key: 'seriesRuc', label: 'RUC emisor', sample: 'RUC:80012345-6', x: 362.8346, y: 760, defaultFontSize: 10.5 },
  { key: 'docTitulo', label: 'Título "FACTURA"', sample: 'FACTURA', x: 362.8346, y: 738, defaultFontSize: 19 },
  { key: 'headerNumero', label: 'N° de factura', sample: 'N° 001-001-0000123', x: 362.8346, y: 712, defaultFontSize: 14 },
  { key: 'fechaEmision', label: 'Fecha de emisión', sample: '23 DE SEPTIEMBRE DE 2026', x: 148, y: 645, defaultFontSize: 8.5 },
  { key: 'clienteNombre', label: 'Nombre del cliente', sample: 'CLIENTE DE EJEMPLO', x: 172, y: 619, defaultFontSize: 9 },
  { key: 'clienteDocumento', label: 'RUC / C.I. del cliente', sample: '1234567', x: 497, y: 619, defaultFontSize: 9 },
  { key: 'unidad', label: 'Unidad', sample: '01-01', x: 420, y: 593, defaultFontSize: 9 },
  { key: 'conceptosBloque', label: 'Bloque de conceptos (todo junto)', sample: 'EXPENSAS CORRESPONDIENTE AL MES DE...', x: 76, y: 510, defaultFontSize: 8.5 },
  { key: 'vencimiento', label: 'Vencimiento', sample: 'Vto. 15/10/2026.', x: 76, y: 262, defaultFontSize: 8.5 },
  { key: 'subtotal', label: 'Subtotal', sample: '576.802', x: 328.8189, y: 226, defaultFontSize: 8.5 },
  { key: 'totalPagar', label: 'Total a pagar', sample: '576.802', x: 493.2283, y: 203, defaultFontSize: 9.5 },
  { key: 'sonEnLetras', label: 'Total en letras ("Son:")', sample: 'GUARANIES QUINIENTOS SETENTA Y SEIS MIL...', x: 82, y: 156, defaultFontSize: 8.5 }
];

const PAGE_W_PT = 595.2756;
const PAGE_H_PT = 841.8898;
const SCALE = 0.72; // px por punto PDF

@Component({
  standalone: true,
  selector: 'app-invoice-series-calibration-page',
  imports: [CommonModule, FormsModule, RouterLink, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Calibrar posiciones</h1>
          <p *ngIf="series">Timbrado {{ series.establecimiento }}-{{ series.puntoExpedicion }}-{{ series.numeroTimbrado }} · {{ series.buildingName }}</p>
        </div>
        <a routerLink="/invoice-series" style="display:contents">
          <p-button label="Volver a timbrados" icon="pi pi-arrow-left" severity="secondary" [text]="true"></p-button>
        </a>
      </div>

      <p class="app-state" *ngIf="loading">Cargando...</p>

      <ng-container *ngIf="!loading && series">
        <div class="calib-toolbar">
          <label class="upload-btn">
            <i class="pi pi-image"></i> {{ uploadingScan ? 'Subiendo...' : (referenceScanUrl ? 'Cambiar escaneo de referencia' : 'Subir escaneo de referencia') }}
            <input type="file" accept="image/*,application/pdf" hidden [disabled]="uploadingScan" (change)="onScanSelected($event)" />
          </label>
          <p-button label="Reiniciar posiciones" icon="pi pi-refresh" severity="secondary" [text]="true" (onClick)="resetAll()"></p-button>
          <span class="spacer"></span>
          <p-button label="Generar PDF de prueba" icon="pi pi-file-pdf" severity="secondary" [outlined]="true" (onClick)="openSamplePdf()"></p-button>
          <p-button label="Guardar posiciones" icon="pi pi-check" [loading]="saving" (onClick)="save()"></p-button>
        </div>

        <p class="calib-hint">
          Arrastrá cada campo hasta que calce sobre el papel. Los datos son de ejemplo (no es una factura real).
          Después de guardar, generá el PDF de prueba e imprimilo sobre el papel preimpreso para verificar.
        </p>

        <label class="hide-frame-check">
          <input type="checkbox" [(ngModel)]="hideFrame" name="hideFrame" [ngModelOptions]="{ standalone: true }" />
          Mi papel ya tiene su propio marco y casillas impresas — no dibujar el marco del sistema, solo el texto.
        </label>

        <div class="calib-workspace">
          <div class="calib-list calib-side">
            <ng-container *ngTemplateOutlet="rowTpl; context: { fields: leftFields }"></ng-container>
          </div>

          <div class="calib-canvas" [style.width.px]="canvasW" [style.height.px]="canvasH">
            <img *ngIf="referenceScanUrl && !isPdf" [src]="resolvedScanUrl" class="calib-bg" [style.width.px]="canvasW" [style.height.px]="canvasH" alt="Papel preimpreso" />
            <iframe *ngIf="referenceScanUrl && isPdf" [src]="resolvedScanUrlSafe" class="calib-bg" [style.width.px]="canvasW" [style.height.px]="canvasH" title="Papel preimpreso"></iframe>

            <div class="calib-field" *ngFor="let f of fields"
                 [style.left.px]="screenX(f)" [style.top.px]="screenY(f)"
                 [style.fontSize.px]="fontSizeOf(f) * SCALE"
                 [class.dragging]="draggingKey === f.key"
                 (mousedown)="startDrag(f, $event)">
              {{ f.sample }}
            </div>
          </div>

          <div class="calib-list calib-side">
            <ng-container *ngTemplateOutlet="rowTpl; context: { fields: rightFields }"></ng-container>
          </div>
        </div>

        <ng-template #rowTpl let-fields="fields">
          <div class="calib-row" *ngFor="let f of fields">
            <span class="calib-row-label">{{ f.label }}</span>
            <span class="calib-row-offset">dx {{ (offsets[f.key]?.dx ?? 0) | number:'1.0-1' }} · dy {{ (offsets[f.key]?.dy ?? 0) | number:'1.0-1' }} pt</span>
            <span class="calib-row-fontsize">
              letra
              <button type="button" class="font-step" (click)="stepFontSize(f, -0.5)">−</button>
              <input type="number" step="0.5" min="4" max="60" class="font-input"
                     [ngModel]="fontSizeOf(f)" (ngModelChange)="setFontSize(f, $event)" [ngModelOptions]="{ standalone: true }" />
              <button type="button" class="font-step" (click)="stepFontSize(f, 0.5)">+</button>
              pt
            </span>
          </div>
        </ng-template>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .app-page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .calib-toolbar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .spacer { flex: 1; }
    .upload-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.55rem 0.9rem; border-radius: 10px; cursor: pointer;
      border: 1.5px solid #d7e5e1; color: #29484f; font-size: 0.9rem; font-weight: 600;
    }
    .upload-btn:hover { border-color: #1385b6; }
    .calib-hint { font-size: 0.82rem; color: #6b878d; margin: 0 0 1rem; }
    .hide-frame-check {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.85rem; color: #29484f; font-weight: 600;
      margin-bottom: 1rem; cursor: pointer;
    }
    .hide-frame-check input { width: auto; }
    .calib-workspace { display: flex; align-items: flex-start; justify-content: center; gap: 1.25rem; margin-bottom: 1.25rem; }
    .calib-canvas {
      position: relative;
      background: #fff;
      border: 1.5px solid #d7e5e1;
      border-radius: 6px;
      flex: none;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    }
    /* fill (no contain): la imagen se estira exacto al tamano del lienzo A4. Si la proporcion original
       no es perfecta, se deforma un poco en vez de dejar margenes en blanco que desalinearian todo. */
    .calib-bg { position: absolute; top: 0; left: 0; object-fit: fill; pointer-events: none; border: 0; }
    .calib-field {
      position: absolute;
      transform: translateY(-100%);
      background: rgba(19,133,182,0.12);
      border: 1px dashed #1385b6;
      color: #0c5878;
      font-size: 10px;
      line-height: 1.3;
      padding: 1px 4px;
      white-space: nowrap;
      cursor: grab;
      user-select: none;
      border-radius: 3px;
    }
    .calib-field.dragging { cursor: grabbing; background: rgba(19,133,182,0.25); z-index: 10; }
    .calib-list { display: grid; gap: 0.25rem; }
    .calib-side { flex: 1 1 0; min-width: 0; max-width: 250px; align-self: stretch; }
    .calib-row {
      display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem;
      padding: 0.4rem 0.5rem; border-bottom: 1px solid #eef3f2; font-size: 0.78rem;
    }
    .calib-row-label { color: #29484f; font-weight: 600; }
    .calib-row-offset { color: #6b878d; font-variant-numeric: tabular-nums; }
    .calib-row-fontsize { display: flex; align-items: center; gap: 0.3rem; color: #6b878d; white-space: nowrap; }
    .font-step {
      width: 20px; height: 20px; border-radius: 4px; border: 1px solid #d7e5e1; background: #fff;
      color: #29484f; font-weight: 700; line-height: 1; cursor: pointer; padding: 0;
    }
    .font-step:hover { border-color: #1385b6; }
    .font-input {
      width: 44px; text-align: center; border: 1px solid #d7e5e1; border-radius: 4px;
      padding: 0.15rem 0.2rem; font-size: 0.8rem; font-variant-numeric: tabular-nums;
    }
    @media (max-width: 1000px) {
      .calib-workspace { flex-direction: column; align-items: center; }
      .calib-side { max-width: 100%; width: 100%; }
    }
  `]
})
export class InvoiceSeriesCalibrationPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seriesApi = inject(InvoiceSeriesApiService);
  private readonly uploadsApi = inject(UploadsApiService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly fields = FIELDS;
  readonly leftFields = FIELDS.slice(0, Math.ceil(FIELDS.length / 2));
  readonly rightFields = FIELDS.slice(Math.ceil(FIELDS.length / 2));
  readonly canvasW = Math.round(PAGE_W_PT * SCALE);
  readonly canvasH = Math.round(PAGE_H_PT * SCALE);
  readonly SCALE = SCALE;

  series: InvoiceSeries | null = null;
  loading = true;
  saving = false;
  uploadingScan = false;
  referenceScanUrl: string | null = null;
  offsets: Record<string, FieldOffset> = {};
  hideFrame = false;

  get resolvedScanUrl(): string { return resolveUploadUrl(this.referenceScanUrl); }
  get resolvedScanUrlSafe(): SafeResourceUrl { return this.sanitizer.bypassSecurityTrustResourceUrl(this.resolvedScanUrl); }
  get isPdf(): boolean { return isPdfUrl(this.referenceScanUrl); }

  private draggingField: CalibField | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragBaseDx = 0;
  private dragBaseDy = 0;
  draggingKey: string | null = null;

  private readonly onMouseMove = (event: MouseEvent) => this.handleMouseMove(event);
  private readonly onMouseUp = () => this.handleMouseUp();

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.seriesApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        const found = list.find((s) => s.id === id) ?? null;
        if (!found) {
          this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se encontró el timbrado.', life: 5000 });
          this.router.navigate(['/invoice-series']);
          return;
        }
        this.series = found;
        this.referenceScanUrl = found.referenceScanUrl ?? null;
        this.offsets = found.fieldPositionsJson ? JSON.parse(found.fieldPositionsJson) : {};
        this.hideFrame = found.hideFrame;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el timbrado.'), life: 5000 });
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  screenX(f: CalibField): number {
    const o = this.offsets[f.key];
    return (f.x + (o?.dx ?? 0)) * SCALE;
  }

  screenY(f: CalibField): number {
    const o = this.offsets[f.key];
    return (PAGE_H_PT - (f.y + (o?.dy ?? 0))) * SCALE;
  }

  fontSizeOf(f: CalibField): number {
    return this.offsets[f.key]?.fontSize ?? f.defaultFontSize;
  }

  setFontSize(f: CalibField, value: number): void {
    if (!value || value <= 0) return;
    const o = this.offsets[f.key];
    this.offsets = { ...this.offsets, [f.key]: { dx: o?.dx ?? 0, dy: o?.dy ?? 0, fontSize: value } };
  }

  stepFontSize(f: CalibField, delta: number): void {
    const next = Math.max(4, Math.round((this.fontSizeOf(f) + delta) * 2) / 2);
    this.setFontSize(f, next);
  }

  startDrag(field: CalibField, event: MouseEvent): void {
    event.preventDefault();
    this.draggingField = field;
    this.draggingKey = field.key;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    const o = this.offsets[field.key];
    this.dragBaseDx = o?.dx ?? 0;
    this.dragBaseDy = o?.dy ?? 0;
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.draggingField) return;
    const deltaXPx = event.clientX - this.dragStartX;
    const deltaYPx = event.clientY - this.dragStartY;
    const dx = this.dragBaseDx + deltaXPx / SCALE;
    const dy = this.dragBaseDy - deltaYPx / SCALE; // pantalla abajo = Y de PDF decrece
    const fontSize = this.offsets[this.draggingField.key]?.fontSize;
    this.offsets = { ...this.offsets, [this.draggingField.key]: { dx, dy, fontSize } };
    this.cdr.markForCheck();
  }

  private handleMouseUp(): void {
    this.draggingField = null;
    this.draggingKey = null;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  resetAll(): void {
    if (!confirm('¿Reiniciar todas las posiciones a los valores por defecto?')) return;
    this.offsets = {};
  }

  async onScanSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingScan = true;
    this.cdr.markForCheck();

    let toUpload = file;
    if (isPdfFile(file)) {
      try {
        toUpload = await pdfFirstPageToPngFile(file);
      } catch (error) {
        this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo convertir el PDF a imagen. Probá subir una foto o captura del papel en su lugar.', life: 6000 });
        this.uploadingScan = false;
        this.cdr.markForCheck();
        return;
      }
    }

    this.uploadsApi.upload(toUpload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ url }) => {
        this.referenceScanUrl = url;
        this.uploadingScan = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo subir el escaneo.'), life: 5000 });
        this.uploadingScan = false;
        this.cdr.markForCheck();
      }
    });
  }

  save(): void {
    if (!this.series) return;
    this.saving = true;
    this.seriesApi.updateFieldPositions(this.series.id, {
      positions: this.offsets,
      referenceScanUrl: this.referenceScanUrl,
      hideFrame: this.hideFrame
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.series = updated;
        this.saving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Posiciones guardadas.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron guardar las posiciones.'), life: 5000 });
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  // El backend genera el PDF de prueba con lo que ya esta guardado en el timbrado, no con lo que
  // esta en pantalla sin guardar — por eso hay que guardar posiciones/escaneo antes de abrirlo.
  openSamplePdf(): void {
    if (!this.series) return;
    this.saving = true;
    this.seriesApi.updateFieldPositions(this.series.id, {
      positions: this.offsets,
      referenceScanUrl: this.referenceScanUrl,
      hideFrame: this.hideFrame
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.series = updated;
        this.saving = false;
        this.cdr.markForCheck();
        const url = this.seriesApi.getSamplePdfUrl(updated.id, this.auth.getToken() ?? '');
        window.open(url, '_blank');
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron guardar las posiciones.'), life: 5000 });
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }
}
