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
  section: string; // seccion desplegable de la pantalla (Encabezado, Cliente...)
  group: string;   // subgrupo dentro de la seccion (p. ej. "Fecha de emisión": su titulo y su valor)
  sample: string;
  rows?: string[]; // bloques de varias lineas (concepto, monto, emisor)
  x: number; // punto PDF de A4 completa, origen abajo-izquierda (igual que InvoicePdfDocument)
  y: number;
  shift?: number; // puntos del papel que se suman al y ya mapeado (la nota del coeficiente va 13 pt mas abajo)
  width: number; // ancho de fabrica del bloque en puntos de A4 completa; 0 = sin ancho propio
  defaultFontSize: number; // debe coincidir con el tamano por defecto en InvoicePdfDocument.cs
  isLabel?: boolean; // titulo impreso en el formulario: arranca sin dibujar si el papel trae su propio marco
  align?: 'L' | 'C' | 'R';
  anchor?: 'top' | 'baseline'; // 'top': el bloque cuelga desde y (edificio, emisor, numero grande)
}

interface CalibSection { name: string; fields: CalibField[]; }
const SECTION_ORDER = ['Encabezado', 'Cliente', 'Conceptos', 'Totales', 'Pie'];

const BOX_X = 362.8346;
const BOX_W = 198.4252;

// Mismas keys, coordenadas, anchos, alineacion y tamanos base que InvoicePdfDocument.cs — si se agrega un bloque
// calibrable ahi (y en CalibratableKeys), hay que agregarlo aca tambien para poder arrastrarlo. Cada titulo y cada
// valor es un bloque propio: se mueve, cambia de letra y de ancho, o no se dibuja si el papel ya lo trae.
const FIELDS: CalibField[] = [
  // Encabezado
  { key: 'edificioLabel', section: 'Encabezado', group: 'Edificio', label: 'Edificio — título', sample: 'Edificio', x: 48, y: 793, width: 0, defaultFontSize: 7.5, isLabel: true },
  { key: 'headerEdificio', section: 'Encabezado', group: 'Edificio', label: 'Edificio — valor', sample: 'EDIFICIO DE EJEMPLO', x: 48, y: 758, width: 126, defaultFontSize: 15, anchor: 'top' },
  { key: 'headerEmisor', section: 'Encabezado', group: 'Emisor', label: 'Razón social / dirección / teléfono', sample: '', rows: ['RAZÓN SOCIAL', 'Dirección del edificio', 'Tel.: 021 000 000'], x: 182, y: 784, width: 164, defaultFontSize: 10, align: 'C', anchor: 'top' },
  { key: 'headerActividad', section: 'Encabezado', group: 'Emisor', label: 'Actividad económica', sample: 'Administración de condominios', x: 182, y: 712, width: 164, defaultFontSize: 7.5, align: 'C', isLabel: true },
  { key: 'headerTimbradoNumero', section: 'Encabezado', group: 'Timbrado', label: 'N° de timbrado', sample: 'TIMBRADO N°12345678', x: BOX_X, y: 795, width: BOX_W, defaultFontSize: 9.5, align: 'C' },
  { key: 'vigenciaDesde', section: 'Encabezado', group: 'Timbrado', label: 'Vigencia desde', sample: 'Fecha Inicio Vigencia:01/01/2026', x: BOX_X, y: 783, width: BOX_W, defaultFontSize: 7.5, align: 'C' },
  { key: 'vigenciaHasta', section: 'Encabezado', group: 'Timbrado', label: 'Vigencia hasta', sample: 'Fecha Fin Vigencia:01/01/2027', x: BOX_X, y: 773, width: BOX_W, defaultFontSize: 7.5, align: 'C' },
  { key: 'seriesRuc', section: 'Encabezado', group: 'Timbrado', label: 'RUC emisor', sample: 'RUC:80012345-0', x: BOX_X, y: 760, width: BOX_W, defaultFontSize: 10.5, align: 'C' },
  { key: 'docTitulo', section: 'Encabezado', group: 'Factura', label: 'Título "FACTURA"', sample: 'FACTURA', x: BOX_X, y: 738, width: BOX_W, defaultFontSize: 19, align: 'C' },
  { key: 'numeroCondicion', section: 'Encabezado', group: 'Factura', label: 'Número y condición (línea tenue)', sample: '001-001-0000123   CONTADO', x: BOX_X, y: 718, width: BOX_W, defaultFontSize: 7, align: 'C', isLabel: true },
  { key: 'headerNumero', section: 'Encabezado', group: 'Factura', label: 'N° de factura', sample: 'Nº 001-001-0000123', x: BOX_X, y: 712, width: BOX_W, defaultFontSize: 14, align: 'C', anchor: 'top' },

  // Cliente
  { key: 'fechaLabel', section: 'Cliente', group: 'Fecha de emisión', label: 'Fecha de emisión — título', sample: 'FECHA DE EMISION:', x: 45, y: 645, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'fechaEmision', section: 'Cliente', group: 'Fecha de emisión', label: 'Fecha de emisión — valor', sample: '23 DE SEPTIEMBRE DE 2026', x: 148, y: 645, width: 160, defaultFontSize: 8.5 },
  { key: 'condicionLabel', section: 'Cliente', group: 'Condición de venta', label: 'Condición de venta — título', sample: 'CONDICION DE VENTA:', x: 292, y: 645, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'contadoLabel', section: 'Cliente', group: 'Condición de venta', label: 'Contado — título', sample: 'CONTADO', x: 404, y: 645, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'marcaContado', section: 'Cliente', group: 'Condición de venta', label: 'Contado — marca X', sample: 'X', x: 452, y: 644.7, width: 11.5, defaultFontSize: 10, align: 'C' },
  { key: 'creditoLabel', section: 'Cliente', group: 'Condición de venta', label: 'Crédito — título', sample: 'CREDITO', x: 472, y: 645, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'nombreLabel', section: 'Cliente', group: 'Nombre o razón social', label: 'Nombre — título', sample: 'NOMBRE O RAZON SOCIAL:', x: 45, y: 619, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'clienteNombre', section: 'Cliente', group: 'Nombre o razón social', label: 'Nombre — valor', sample: 'CLIENTE DE EJEMPLO', x: 172, y: 619, width: 280, defaultFontSize: 9 },
  { key: 'ciLabel', section: 'Cliente', group: 'C.I.', label: 'C.I. — título ("DOC. Nº" si no es cédula)', sample: 'C.I. Nº', x: 470, y: 619, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'clienteDocumento', section: 'Cliente', group: 'C.I.', label: 'C.I. / documento — valor (cédula, pasaporte u otro)', sample: '1234567', x: 497, y: 619, width: 60, defaultFontSize: 9 },
  { key: 'rucLabel', section: 'Cliente', group: 'RUC', label: 'RUC — título', sample: 'RUC:', x: 45, y: 593, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'clienteRuc', section: 'Cliente', group: 'RUC', label: 'RUC — valor (cliente con RUC)', sample: '8540611-2', x: 74, y: 593, width: 200, defaultFontSize: 9 },
  { key: 'unidadLabel', section: 'Cliente', group: 'Unidad', label: 'Unidad — título', sample: 'UNIDAD', x: 300, y: 593, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'unidad', section: 'Cliente', group: 'Unidad', label: 'Unidad — valor', sample: '01-01', x: 420, y: 593, width: 135, defaultFontSize: 9, align: 'R' },

  // Conceptos: títulos de la tabla y las tres columnas de datos
  { key: 'itemLabel', section: 'Conceptos', group: 'Títulos de la tabla', label: 'ITEM — título', sample: 'ITEM', x: 34.01575, y: 537, width: 36.85039, defaultFontSize: 8.5, align: 'C', isLabel: true },
  { key: 'conceptoLabel', section: 'Conceptos', group: 'Títulos de la tabla', label: 'CONCEPTO — título', sample: 'CONCEPTO', x: 70.86614, y: 537, width: 257.95276, defaultFontSize: 9, align: 'C', isLabel: true },
  { key: 'valorVentaLabel', section: 'Conceptos', group: 'Títulos de la tabla', label: 'VALOR DE VENTA — título', sample: 'VALOR DE VENTA', x: 328.8189, y: 552, width: 232.4409, defaultFontSize: 8.5, align: 'C', isLabel: true },
  { key: 'exentasLabel', section: 'Conceptos', group: 'Títulos de la tabla', label: 'EXENTAS — título', sample: 'EXENTAS', x: 328.8189, y: 531, width: 82.2047, defaultFontSize: 8.5, align: 'C', isLabel: true },
  { key: 'pct5Label', section: 'Conceptos', group: 'Títulos de la tabla', label: '5% — título', sample: '5%', x: 411.0236, y: 531, width: 82.2047, defaultFontSize: 8.5, align: 'C', isLabel: true },
  { key: 'pct10Label', section: 'Conceptos', group: 'Títulos de la tabla', label: '10% — título', sample: '10%', x: 493.2283, y: 531, width: 68.0315, defaultFontSize: 8.5, align: 'C', isLabel: true },
  { key: 'conceptosBloque', section: 'Conceptos', group: 'Renglones', label: 'Concepto — valor', sample: '', rows: ['EXPENSAS CORRESPONDIENTE AL MES DE SEP/2026'], x: 76, y: 510, width: 248, defaultFontSize: 8.5 },
  { key: 'montoExentas', section: 'Conceptos', group: 'Renglones', label: 'Monto (exentas) — valor', sample: '', rows: ['576.802'], x: 328.8189, y: 510, width: 76.2047, defaultFontSize: 8.5, align: 'R' },
  { key: 'conceptosNota', section: 'Conceptos', group: 'Renglones', label: 'Nota del coeficiente', sample: '', rows: ['Coeficiente: 0,7 % de 68.666.823'], x: 76, y: 510, shift: -13, width: 248, defaultFontSize: 7.5 },
  { key: 'vencimiento', section: 'Conceptos', group: 'Vencimiento', label: 'Vencimiento — valor', sample: 'Vto. 15/10/2026.', x: 76, y: 262, width: 0, defaultFontSize: 8.5 },

  // Totales
  { key: 'subtotalesLabel', section: 'Totales', group: 'Subtotales', label: 'Subtotales — título', sample: 'SUBTOTALES', x: 45, y: 226, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'subtotal', section: 'Totales', group: 'Subtotales', label: 'Subtotales — valor', sample: '576.802', x: 328.8189, y: 226, width: 76.2047, defaultFontSize: 8.5, align: 'R' },
  { key: 'totalLabel', section: 'Totales', group: 'Total a pagar', label: 'Total a pagar — título', sample: 'TOTAL A PAGAR', x: 45, y: 203, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'totalPagar', section: 'Totales', group: 'Total a pagar', label: 'Total a pagar — valor', sample: '576.802', x: 493.2283, y: 203, width: 62.0315, defaultFontSize: 9.5, align: 'R' },
  { key: 'liqLabel', section: 'Totales', group: 'Liquidación del IVA', label: 'Liquidación del IVA (5%) — título', sample: 'LIQUIDACION DEL IVA: (5%)', x: 45, y: 180, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'liq10Label', section: 'Totales', group: 'Liquidación del IVA', label: 'Liquidación (10%) — título', sample: '(10%)', x: 332, y: 180, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'totalIvaLabel', section: 'Totales', group: 'Liquidación del IVA', label: 'Total IVA — título', sample: 'TOTAL IVA:', x: 470, y: 180, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'sonLabel', section: 'Totales', group: 'Son', label: 'Son — título', sample: 'SON:', x: 45, y: 156, width: 0, defaultFontSize: 8.5, isLabel: true },
  { key: 'sonEnLetras', section: 'Totales', group: 'Son', label: 'Son — total en letras', sample: 'GUARANÍES QUINIENTOS SETENTA Y SEIS MIL...', x: 82, y: 156, width: 474, defaultFontSize: 8.5 },

  // Pie
  { key: 'pieOriginal', section: 'Pie', group: 'Copias', label: 'Original: Comprador — Copia…', sample: 'Original: Comprador - Copia: Arch. Tributario', x: 34.01575, y: 131, width: 527.2441, defaultFontSize: 6.5, align: 'R', isLabel: true },
  { key: 'pieCopia', section: 'Pie', group: 'Copias', label: '2° Copia: Contabilidad…', sample: '2°Copia: Contabilidad(No válido p/ crédito fiscal)', x: 34.01575, y: 122, width: 527.2441, defaultFontSize: 6.5, align: 'R', isLabel: true }
];

const PAGE_W_PT = 595.2756;
const PAGE_H_PT = 841.8898;
// px por punto PDF a zoom 100%: 96/72 = tamano real de una A4 en pantalla (794 x 1123 px), para poder
// calibrar al milimetro. El zoom del selector multiplica esta base.
const BASE_SCALE = 96 / 72;
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5];

// Media A4: pares (A4 completa -> media A4) en puntos PDF. Deben coincidir con HalfX / HalfY de
// InvoicePdfDocument.cs. El lienzo muestra solo la mitad superior de la hoja (hasta y = 400).
const HALF_X: [number, number][] = [
  [34.01575, 14.2], [70.86614, 44], [328.8189, 316.4], [351.4961, 344.8],
  [362.8346, 353.7], [411.0236, 405.2], [493.2283, 495.5], [561.2598, 587.3]
];
const HALF_Y: [number, number][] = [
  [147.4016, 443.4], [172.9134, 459], [195.5906, 479.2], [218.2677, 497.9],
  [243.7795, 515], [524.4094, 641.1], [542.8346, 655.4], [552, 658.3],
  [561.2598, 667.2], [572.5984, 671.7], [663.3071, 720.2], [674.6457, 726.2],
  [712, 754], [718, 760], [738, 775], [760, 793], [773, 804], [783, 812.5], [795, 822],
  [807.874, 830.7]
];
const HALF_VIEW_H_PT = 441.8898;

function interpolate(table: [number, number][], v: number): number {
  if (v <= table[0][0]) return table[0][1] + (v - table[0][0]);
  for (let i = 1; i < table.length; i++) {
    if (v > table[i][0]) continue;
    const [f0, t0] = table[i - 1];
    const [f1, t1] = table[i];
    return t0 + (v - f0) * (t1 - t0) / (f1 - f0);
  }
  const last = table[table.length - 1];
  return last[1] + (v - last[0]);
}

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
          <span class="zoom-ctl">
            Zoom
            <select class="zoom-select" [ngModel]="zoom" (ngModelChange)="setZoom($event)" [ngModelOptions]="{ standalone: true }">
              <option *ngFor="let z of zoomLevels" [ngValue]="z">{{ z * 100 }}%</option>
            </select>
          </span>
          <span class="spacer"></span>
          <p-button label="Generar PDF de prueba" icon="pi pi-file-pdf" severity="secondary" [outlined]="true" [disabled]="saving" (onClick)="openSamplePdf()"></p-button>
          <p-button label="Guardar posiciones" icon="pi pi-check" [loading]="saving" (onClick)="save()"></p-button>
        </div>

        <p class="calib-hint">
          Arrastrá cada bloque sobre el papel, o ajustalo con los controles de los paneles (cada panel tiene su propio scroll).
          Cada dato tiene su título y su valor por separado: marcá "No dibujar" en lo que tu papel ya trae impreso. Los datos son de
          ejemplo (no es una factura real). Guardá y generá el PDF de prueba para verificar antes de imprimir.
        </p>

        <div class="calib-options">
          <label class="hide-frame-check">
            <input type="checkbox" [(ngModel)]="hideFrame" name="hideFrame" [ngModelOptions]="{ standalone: true }" />
            Mi papel ya tiene su propio marco, casillas y títulos impresos — no dibujar el marco ni los títulos del sistema, solo los datos.
          </label>
          <label class="hide-frame-check">
            <input type="checkbox" [(ngModel)]="halfPage" name="halfPage" [ngModelOptions]="{ standalone: true }" />
            Mi papel es de media A4 (210 × 148 mm): la factura ocupa solo la mitad superior de la hoja.
          </label>
          <span class="section-actions">
            <button type="button" class="link-btn" (click)="setAllSections(true)">Expandir todo</button>
            <button type="button" class="link-btn" (click)="setAllSections(false)">Contraer todo</button>
          </span>
        </div>

        <div class="calib-workspace">
          <div class="calib-list calib-side">
            <ng-container *ngTemplateOutlet="sectionsTpl; context: { sections: leftSections }"></ng-container>
          </div>

          <div class="calib-canvas-wrap">
            <div class="calib-canvas" [style.width.px]="canvasW" [style.height.px]="canvasH">
              <img *ngIf="referenceScanUrl && !isPdf" [src]="resolvedScanUrl" class="calib-bg" [style.width.px]="pageW" [style.height.px]="pageH" alt="Papel preimpreso" />
              <iframe *ngIf="referenceScanUrl && isPdf" [src]="resolvedScanUrlSafe" class="calib-bg" [style.width.px]="pageW" [style.height.px]="pageH" title="Papel preimpreso"></iframe>

              <ng-container *ngFor="let f of fields">
                <div class="calib-field" *ngIf="!isHidden(f)"
                     [style.left.px]="screenX(f)" [style.top.px]="screenY(f)"
                     [style.fontSize.px]="fontSizeOf(f) * scale"
                     [style.width.px]="widthOf(f) ? widthOf(f) * scale : null"
                     [style.textAlign]="alignOf(f)"
                     [class.on-baseline]="f.anchor !== 'top'"
                     [class.dragging]="draggingKey === f.key"
                     (mousedown)="startDrag(f, $event)">
                  <div class="calib-line" *ngFor="let text of rowsOf(f)">{{ text }}</div>
                </div>
              </ng-container>
            </div>
          </div>

          <div class="calib-list calib-side">
            <ng-container *ngTemplateOutlet="sectionsTpl; context: { sections: rightSections }"></ng-container>
          </div>
        </div>

        <ng-template #sectionsTpl let-sections="sections">
          <div class="calib-section" *ngFor="let sec of sections">
            <button type="button" class="calib-section-head" (click)="toggleSection(sec.name)" [attr.aria-expanded]="isOpen(sec.name)">
              <i class="pi" [ngClass]="isOpen(sec.name) ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
              <span>{{ sec.name }}</span>
              <span class="calib-section-count">{{ sec.fields.length }}</span>
            </button>
            <div class="calib-section-body" *ngIf="isOpen(sec.name)">
              <ng-container *ngTemplateOutlet="rowTpl; context: { fields: sec.fields }"></ng-container>
            </div>
          </div>
        </ng-template>

        <ng-template #rowTpl let-fields="fields">
          <ng-container *ngFor="let f of fields; let i = index">
            <div class="calib-group" *ngIf="f.group && (i === 0 || fields[i - 1].group !== f.group)">{{ f.group }}</div>
            <div class="calib-row" [class.is-hidden]="isHidden(f)">
              <div class="calib-row-head">
                <span class="calib-row-label">{{ f.label }}</span>
                <span class="calib-row-offset">dx {{ (offsets[f.key]?.dx ?? 0) | number:'1.0-1' }} · dy {{ (offsets[f.key]?.dy ?? 0) | number:'1.0-1' }}</span>
              </div>
              <div class="calib-row-controls">
                <span class="ctl">
                  letra
                  <button type="button" class="font-step" (click)="stepFontSize(f, -0.5)">−</button>
                  <input type="number" step="0.5" min="4" max="60" class="font-input"
                         [ngModel]="fontSizeOf(f)" (ngModelChange)="setFontSize(f, $event)" [ngModelOptions]="{ standalone: true }" />
                  <button type="button" class="font-step" (click)="stepFontSize(f, 0.5)">+</button>
                </span>
                <span class="ctl" *ngIf="f.width">
                  ancho
                  <button type="button" class="font-step" (click)="stepWidth(f, -5)">−</button>
                  <input type="number" step="1" min="10" max="600" class="font-input wide"
                         [ngModel]="widthOf(f) | number:'1.0-0'" (ngModelChange)="setWidth(f, $event)" [ngModelOptions]="{ standalone: true }" />
                  <button type="button" class="font-step" (click)="stepWidth(f, 5)">+</button>
                </span>
                <label class="hide-check" title="Marcalo si tu papel ya lo trae impreso: el sistema no lo dibuja">
                  <input type="checkbox" [ngModel]="isHidden(f)" (ngModelChange)="setHidden(f, $event)" [ngModelOptions]="{ standalone: true }" />
                  No dibujar
                </label>
              </div>
            </div>
          </ng-container>
        </ng-template>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .app-page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
    .calib-toolbar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .spacer { flex: 1; }
    .zoom-ctl { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: #29484f; font-weight: 600; }
    .zoom-select { border: 1px solid #d7e5e1; border-radius: 6px; padding: 0.3rem 0.4rem; font-size: 0.85rem; }
    .upload-btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.55rem 0.9rem; border-radius: 10px; cursor: pointer;
      border: 1.5px solid #d7e5e1; color: #29484f; font-size: 0.9rem; font-weight: 600;
    }
    .upload-btn:hover { border-color: #1385b6; }
    .calib-hint { font-size: 0.82rem; color: #6b878d; margin: 0 0 1rem; }
    .calib-options { display: flex; align-items: center; gap: 0.5rem 1.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .hide-frame-check {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.85rem; color: #29484f; font-weight: 600; cursor: pointer;
    }
    .hide-frame-check input { width: auto; }
    .section-actions { display: flex; gap: 0.75rem; }
    .link-btn { border: 0; background: none; padding: 0; cursor: pointer; color: #1385b6; font-size: 0.8rem; font-weight: 600; }
    .link-btn:hover { text-decoration: underline; }
    /* Tres paneles: controles | hoja | controles. Los de los costados usan el ancho libre y cada panel tiene su
       propio scroll, asi la hoja se ve completa sin tener que bajar la pagina. */
    .calib-workspace {
      display: grid; grid-template-columns: minmax(260px, 1fr) auto minmax(260px, 1fr);
      gap: 1rem; align-items: start; margin-bottom: 1rem;
      height: calc(100vh - 360px); min-height: 480px;
    }
    .calib-canvas-wrap { overflow: auto; max-height: 100%; max-width: 100%; }
    .calib-canvas {
      position: relative;
      background: #fff;
      border: 1.5px solid #d7e5e1;
      border-radius: 6px;
      flex: none;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    }
    /* Igual que el PDF de prueba (QuestPDF FitArea): la imagen se ajusta a la A4 completa conservando su
       proporcion y pegada arriba a la izquierda. Con media A4 el lienzo (overflow hidden) solo deja ver
       la mitad superior de esa hoja. */
    .calib-bg { position: absolute; top: 0; left: 0; object-fit: contain; object-position: top left; pointer-events: none; border: 0; }
    .calib-field {
      position: absolute;
      box-sizing: border-box;
      background: rgba(19,133,182,0.12);
      border: 1px dashed #1385b6;
      color: #0c5878;
      font-size: 10px;
      line-height: 1.3;
      padding: 0 2px;
      white-space: nowrap;
      cursor: grab;
      user-select: none;
      border-radius: 3px;
    }
    .calib-field.on-baseline { transform: translateY(-100%); }
    .calib-field.dragging { cursor: grabbing; background: rgba(19,133,182,0.25); z-index: 10; }
    .calib-line { overflow: hidden; text-overflow: ellipsis; }
    .calib-section { border: 1px solid #e3ecea; border-radius: 8px; overflow: hidden; background: #fff; }
    .calib-section-head {
      display: flex; align-items: center; gap: 0.5rem; width: 100%;
      padding: 0.5rem 0.65rem; border: 0; background: #f4f9f8; cursor: pointer;
      font-size: 0.85rem; font-weight: 700; color: #29484f; text-align: left;
    }
    .calib-section-head:hover { background: #eaf4f3; }
    .calib-section-count { margin-left: auto; font-size: 0.72rem; font-weight: 600; color: #6b878d; background: #fff; border-radius: 999px; padding: 0 0.5rem; }
    .calib-section-body { padding-bottom: 0.25rem; }
    .calib-group { margin-top: 0.6rem; padding: 0.2rem 0.5rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #1385b6; }
    .calib-list { display: grid; gap: 0.25rem; align-content: start; }
    .calib-side { min-width: 0; max-height: 100%; overflow-y: auto; padding-right: 0.25rem; }
    .calib-row { padding: 0.3rem 0.5rem; border-bottom: 1px solid #eef3f2; font-size: 0.78rem; }
    .calib-row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
    .calib-row-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem 0.85rem; margin-top: 0.15rem; }
    .ctl { display: inline-flex; align-items: center; gap: 0.25rem; color: #6b878d; white-space: nowrap; }
    .calib-row.is-hidden { opacity: 0.55; }
    .calib-row-label { color: #29484f; font-weight: 600; }
    .calib-row-offset { color: #6b878d; font-variant-numeric: tabular-nums; }
    .hide-check { display: flex; align-items: center; gap: 0.35rem; color: #6b878d; cursor: pointer; }
    .hide-check input { width: auto; }
    .font-step {
      width: 20px; height: 20px; border-radius: 4px; border: 1px solid #d7e5e1; background: #fff;
      color: #29484f; font-weight: 700; line-height: 1; cursor: pointer; padding: 0;
    }
    .font-step:hover { border-color: #1385b6; }
    .font-input {
      width: 44px; text-align: center; border: 1px solid #d7e5e1; border-radius: 4px;
      padding: 0.15rem 0.2rem; font-size: 0.8rem; font-variant-numeric: tabular-nums;
    }
    .font-input.wide { width: 52px; }
    @media (max-width: 1400px) {
      .calib-workspace { grid-template-columns: 1fr 1fr; height: auto; }
      .calib-canvas-wrap { grid-column: 1 / -1; grid-row: 1; max-height: none; }
      .calib-side { max-height: none; overflow: visible; }
    }
    @media (max-width: 800px) {
      .calib-workspace { grid-template-columns: 1fr; }
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
  // Los controles van agrupados en secciones desplegables (todo lo del cliente junto, etc.).
  readonly sections: CalibSection[] = SECTION_ORDER.map((name) => ({ name, fields: FIELDS.filter((f) => f.section === name) }));
  readonly leftSections = this.sections.slice(0, 2);
  readonly rightSections = this.sections.slice(2);
  openSections: Record<string, boolean> = Object.fromEntries(SECTION_ORDER.map((name) => [name, true]));
  readonly zoomLevels = ZOOM_LEVELS;
  zoom = 1;

  series: InvoiceSeries | null = null;
  loading = true;
  saving = false;
  uploadingScan = false;
  referenceScanUrl: string | null = null;
  offsets: Record<string, FieldOffset> = {};
  hideFrame = false;
  halfPage = false;

  // px por punto PDF: la hoja se agranda o achica con el zoom, las posiciones guardadas (en puntos) no cambian.
  get scale(): number { return BASE_SCALE * this.zoom; }
  get canvasW(): number { return Math.round(PAGE_W_PT * this.scale); }
  get canvasH(): number { return Math.round((this.halfPage ? HALF_VIEW_H_PT : PAGE_H_PT) * this.scale); }
  get pageW(): number { return Math.round(PAGE_W_PT * this.scale); }
  get pageH(): number { return Math.round(PAGE_H_PT * this.scale); }

  setZoom(value: number): void {
    if (ZOOM_LEVELS.includes(value)) this.zoom = value;
  }

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
        this.applySeries(found);
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

  // Lo que se ve en pantalla es siempre lo que quedo guardado: tras guardar se vuelve a leer del timbrado.
  private applySeries(found: InvoiceSeries): void {
    this.series = found;
    this.referenceScanUrl = found.referenceScanUrl ?? null;
    this.offsets = this.parseOffsets(found.fieldPositionsJson);
    this.hideFrame = found.hideFrame;
    this.halfPage = found.halfPage ?? false;
  }

  // El backend guarda en camelCase; se acepta tambien PascalCase por lo que quedo guardado antes.
  private parseOffsets(json?: string | null): Record<string, FieldOffset> {
    if (!json) return {};
    try {
      const raw = JSON.parse(json) as Record<string, Record<string, unknown>>;
      const pick = (v: Record<string, unknown>, name: string): unknown => v[name] ?? v[name.charAt(0).toUpperCase() + name.slice(1)];
      const result: Record<string, FieldOffset> = {};
      for (const [key, value] of Object.entries(raw)) {
        result[key] = {
          dx: Number(pick(value, 'dx') ?? 0),
          dy: Number(pick(value, 'dy') ?? 0),
          fontSize: (pick(value, 'fontSize') ?? null) as number | null,
          width: (pick(value, 'width') ?? null) as number | null,
          hidden: (pick(value, 'hidden') ?? undefined) as boolean | undefined
        };
      }
      return result;
    } catch {
      return {};
    }
  }

  // Cambia solo lo indicado de un bloque y conserva el resto (posicion, letra, ancho, oculto).
  private patch(key: string, change: Partial<FieldOffset>): void {
    const current = this.offsets[key] ?? { dx: 0, dy: 0 };
    this.offsets = { ...this.offsets, [key]: { ...current, ...change } };
  }

  // Las x/y de FIELDS estan en puntos de A4 completa; con media A4 se llevan al papel real igual que
  // hace InvoicePdfDocument.cs (MX/MY), y recien ahi se suma el offset calibrado.
  mapX(x: number): number { return this.halfPage ? interpolate(HALF_X, x) : x; }
  mapY(y: number): number { return this.halfPage ? interpolate(HALF_Y, y) : y; }
  private mapW(x: number, width: number): number { return this.halfPage ? this.mapX(x + width) - this.mapX(x) : width; }

  screenX(f: CalibField): number {
    return (this.mapX(f.x) + (this.offsets[f.key]?.dx ?? 0)) * this.scale;
  }

  screenY(f: CalibField): number {
    return (PAGE_H_PT - (this.mapY(f.y) + (f.shift ?? 0) + (this.offsets[f.key]?.dy ?? 0))) * this.scale;
  }

  fontSizeOf(f: CalibField): number {
    return this.offsets[f.key]?.fontSize ?? f.defaultFontSize;
  }

  // Ancho en puntos del papel: el calibrado, o el de fabrica llevado al papel.
  widthOf(f: CalibField): number {
    return this.offsets[f.key]?.width ?? this.mapW(f.x, f.width);
  }

  alignOf(f: CalibField): string | null {
    return f.align === 'R' ? 'right' : f.align === 'C' ? 'center' : null;
  }

  rowsOf(f: CalibField): string[] {
    return f.rows ?? [f.sample];
  }

  // Sin decision guardada, los titulos se ocultan cuando el papel trae su propio marco (igual que el PDF).
  isHidden(f: CalibField): boolean {
    return this.offsets[f.key]?.hidden ?? (f.isLabel === true && this.hideFrame);
  }

  isOpen(name: string): boolean { return this.openSections[name] === true; }
  toggleSection(name: string): void { this.openSections = { ...this.openSections, [name]: !this.isOpen(name) }; }
  setAllSections(open: boolean): void {
    this.openSections = Object.fromEntries(SECTION_ORDER.map((name) => [name, open]));
  }

  setFontSize(f: CalibField, value: number): void {
    if (!value || value <= 0) return;
    this.patch(f.key, { fontSize: value });
  }

  stepFontSize(f: CalibField, delta: number): void {
    this.setFontSize(f, Math.max(4, Math.round((this.fontSizeOf(f) + delta) * 2) / 2));
  }

  setWidth(f: CalibField, value: number | string): void {
    const width = Number(value);
    if (!width || width < 10 || width > 600) return;
    this.patch(f.key, { width });
  }

  stepWidth(f: CalibField, delta: number): void {
    this.setWidth(f, Math.max(10, Math.round(this.widthOf(f) + delta)));
  }

  setHidden(f: CalibField, hidden: boolean): void {
    this.patch(f.key, { hidden });
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
    const dx = this.dragBaseDx + (event.clientX - this.dragStartX) / this.scale;
    const dy = this.dragBaseDy - (event.clientY - this.dragStartY) / this.scale; // pantalla abajo = Y de PDF decrece
    this.patch(this.draggingField.key, { dx, dy });
    this.cdr.markForCheck();
  }

  private handleMouseUp(): void {
    this.draggingField = null;
    this.draggingKey = null;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  resetAll(): void {
    if (!confirm('¿Reiniciar todas las posiciones, tamaños de letra, anchos y bloques ocultos a los valores por defecto?')) return;
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

  private persist(onSaved: (updated: InvoiceSeries) => void): void {
    if (!this.series) return;
    this.saving = true;
    this.seriesApi.updateFieldPositions(this.series.id, {
      positions: this.offsets,
      referenceScanUrl: this.referenceScanUrl,
      hideFrame: this.hideFrame,
      halfPage: this.halfPage
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.applySeries(updated);
        this.saving = false;
        this.cdr.markForCheck();
        onSaved(updated);
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron guardar las posiciones.'), life: 5000 });
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  save(): void {
    this.persist(() => this.msg.add({ severity: 'success', summary: 'Éxito', detail: 'Posiciones guardadas.', life: 4000 }));
  }

  // El backend genera el PDF de prueba con lo que ya esta guardado en el timbrado, no con lo que
  // esta en pantalla sin guardar — por eso hay que guardar posiciones/escaneo antes de abrirlo.
  openSamplePdf(): void {
    this.persist((updated) => {
      window.open(this.seriesApi.getSamplePdfUrl(updated.id, this.auth.getToken() ?? ''), '_blank');
    });
  }
}
