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
import { BuildingsApiService } from '../../api/buildings-api.service';
import { AuthService } from '../../auth/auth.service';
import { Building, FieldOffset } from '../../api/models';

type BlockKind = 'text' | 'column' | 'image';
type ColumnKey = 'colConcepto' | 'colDescripcion' | 'colReserva' | 'colMonto';

interface CalibField {
  key: string;
  label: string;
  group: string;
  kind: BlockKind;
  sample: string;
  x: number;   // punto PDF, desde la esquina superior izquierda (igual que SettlementPdfDocument.cs)
  top: number;
  width: number; // ancho del bloque en puntos; 0 = texto de una linea sin ancho propio
  defaultFontSize: number; // debe coincidir con el tamano por defecto en SettlementPdfDocument.cs
  align?: 'L' | 'C' | 'R'; // alineacion dentro del ancho (montos a la derecha, nombres centrados)
}

const IMAGE_H_PT = 40; // alto del cajetin de una firma (imagen)

// Cada dato es un bloque propio (etiqueta y valor por separado). Mismas keys, posiciones, anchos, alineacion y
// tamanos base que FieldDefaults en SettlementPdfDocument.cs — si se agrega un bloque calibrable ahi, hay que
// agregarlo aca tambien para poder arrastrarlo.
const FIELDS: CalibField[] = [
  // Encabezado
  { key: 'titulo',   group: 'Encabezado', label: 'Título',           kind: 'text', sample: 'LIQUIDACIÓN EXPENSAS COMUNES', x: 195, top: 86,  width: 0, defaultFontSize: 11 },
  { key: 'edificio', group: 'Encabezado', label: 'Edificio (valor)', kind: 'text', sample: 'EDIFICIO DE EJEMPLO',           x: 66,  top: 100, width: 0, defaultFontSize: 8 },
  { key: 'mes',      group: 'Encabezado', label: 'Mes (valor)',      kind: 'text', sample: 'ABRIL',                         x: 215, top: 112, width: 0, defaultFontSize: 10 },
  { key: 'anio',     group: 'Encabezado', label: 'Año (valor)',      kind: 'text', sample: '2026',                          x: 330, top: 112, width: 0, defaultFontSize: 10 },

  // Cuerpo: una columna por bloque
  { key: 'colConcepto',    group: 'Cuerpo', label: 'Columna CONCEPTO (proveedor)',      kind: 'column', sample: '', x: 50,  top: 145, width: 135, defaultFontSize: 8 },
  { key: 'colDescripcion', group: 'Cuerpo', label: 'Columna DESCRIPCIÓN DE CONCEPTO',   kind: 'column', sample: '', x: 185, top: 145, width: 220, defaultFontSize: 8 },
  { key: 'colReserva',     group: 'Cuerpo', label: 'Columna MONTO fondo de reserva',    kind: 'column', sample: '', x: 405, top: 145, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'colMonto',       group: 'Cuerpo', label: 'Columna MONTO gastos comunes',      kind: 'column', sample: '', x: 475, top: 145, width: 70,  defaultFontSize: 8, align: 'R' },

  // Totales (solo en la última hoja)
  { key: 'totIngresosLabel', group: 'Totales', label: 'Total para gastos — título',        kind: 'text', sample: 'TOTAL PARA GASTOS',     x: 50,  top: 585, width: 200, defaultFontSize: 8 },
  { key: 'totIngresosValor', group: 'Totales', label: 'Total para gastos — valor',         kind: 'text', sample: '3.400.000',             x: 475, top: 585, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'totGastosLabel',   group: 'Totales', label: 'Total gastos del mes — título',     kind: 'text', sample: 'TOTAL GASTOS DEL MES',  x: 50,  top: 598, width: 200, defaultFontSize: 8 },
  { key: 'totGastosReserva', group: 'Totales', label: 'Total gastos — valor fondo de reserva', kind: 'text', sample: '2.640.000',        x: 405, top: 598, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'totGastosComunes', group: 'Totales', label: 'Total gastos — valor gastos comunes',   kind: 'text', sample: '37.180.000',       x: 475, top: 598, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'subTotalLabel',    group: 'Totales', label: 'Sub total general — título',        kind: 'text', sample: 'SUB TOTAL GENERAL GS.', x: 300, top: 611, width: 170, defaultFontSize: 8 },
  { key: 'subTotalValor',    group: 'Totales', label: 'Sub total general — valor',         kind: 'text', sample: '39.820.000',            x: 475, top: 611, width: 70,  defaultFontSize: 8, align: 'R' },
  { key: 'totalLabel',       group: 'Totales', label: 'Total general — título',            kind: 'text', sample: 'TOTAL GENERAL GS. (MONTO NETO A DISTRIBUIR)', x: 300, top: 624, width: 170, defaultFontSize: 8 },
  { key: 'totalValor',       group: 'Totales', label: 'Total general — valor',             kind: 'text', sample: '40.190.000',            x: 475, top: 624, width: 70,  defaultFontSize: 8, align: 'R' },

  // Fechas
  { key: 'fechaEmision',     group: 'Fechas', label: 'Fecha de emisión (solo el valor)', kind: 'text', sample: '30/04/2026',  x: 165, top: 705, width: 0, defaultFontSize: 8 },
  { key: 'vigenciaLabel',    group: 'Fechas', label: 'Vigencia — título',                kind: 'text', sample: 'VIGENCIA',    x: 52,  top: 745, width: 0, defaultFontSize: 8 },
  { key: 'vigenciaDesde',    group: 'Fechas', label: 'Vigencia — desde',                 kind: 'text', sample: '01/04/2026',  x: 110, top: 745, width: 0, defaultFontSize: 8 },
  { key: 'vigenciaHasta',    group: 'Fechas', label: 'Vigencia — hasta',                 kind: 'text', sample: '30/04/2026',  x: 165, top: 745, width: 0, defaultFontSize: 8 },
  { key: 'vencimientoLabel', group: 'Fechas', label: 'Vencimiento — título',             kind: 'text', sample: 'VENCIMIENTO', x: 52,  top: 757, width: 0, defaultFontSize: 8 },
  { key: 'vencimiento',      group: 'Fechas', label: 'Vencimiento — valor',              kind: 'text', sample: '20/05/2026',  x: 120, top: 757, width: 0, defaultFontSize: 8 },

  // Firmas: imagen, nombre y cargo por separado. Autorizado = presidente; Verificación = building manager; Admin = company admin
  { key: 'firmaAutorizado',       group: 'Firma AUTORIZADO POR (presidente)', label: 'Imagen de la firma', kind: 'image', sample: 'firma',                   x: 250, top: 655, width: 110, defaultFontSize: 8 },
  { key: 'firmaAutorizadoNombre', group: 'Firma AUTORIZADO POR (presidente)', label: 'Nombre',             kind: 'text',  sample: 'Nombre Apellido',         x: 215, top: 700, width: 175, defaultFontSize: 8, align: 'C' },
  { key: 'firmaAutorizadoCargo',  group: 'Firma AUTORIZADO POR (presidente)', label: 'Cargo',              kind: 'text',  sample: 'Presidente del consorcio', x: 215, top: 711, width: 175, defaultFontSize: 8, align: 'C' },
  { key: 'firmaVerificacion',       group: 'Firma VERIFICACIÓN (building manager)', label: 'Imagen de la firma', kind: 'image', sample: 'firma',              x: 420, top: 655, width: 110, defaultFontSize: 8 },
  { key: 'firmaVerificacionNombre', group: 'Firma VERIFICACIÓN (building manager)', label: 'Nombre',             kind: 'text',  sample: 'Nombre Apellido',    x: 400, top: 700, width: 145, defaultFontSize: 8, align: 'C' },
  { key: 'firmaVerificacionCargo',  group: 'Firma VERIFICACIÓN (building manager)', label: 'Cargo',              kind: 'text',  sample: 'Encargado de edificio', x: 400, top: 711, width: 145, defaultFontSize: 8, align: 'C' },
  { key: 'firmaAdmin',       group: 'Firma administración (company admin)', label: 'Imagen de la firma', kind: 'image', sample: 'firma',                    x: 250, top: 730, width: 110, defaultFontSize: 8 },
  { key: 'firmaAdminNombre', group: 'Firma administración (company admin)', label: 'Nombre',             kind: 'text',  sample: 'Nombre Apellido',          x: 215, top: 775, width: 175, defaultFontSize: 8, align: 'C' },
  { key: 'firmaAdminCargo',  group: 'Firma administración (company admin)', label: 'Cargo',              kind: 'text',  sample: 'Administrador de la empresa', x: 215, top: 786, width: 175, defaultFontSize: 8, align: 'C' },

  // Pie
  { key: 'pieGenerado', group: 'Pie', label: 'Generado el (fecha y hora)', kind: 'text', sample: 'Generado el 30/04/2026 12:00', x: 50,  top: 815, width: 300, defaultFontSize: 7 },
  { key: 'piePagina',   group: 'Pie', label: 'N° de hoja',                 kind: 'text', sample: '1 / 1',                        x: 500, top: 815, width: 45,  defaultFontSize: 7, align: 'R' }
];

// Filas de ejemplo de cada columna (una fila por renglon del cuerpo).
const COLUMN_SAMPLES: Record<ColumnKey, string[]> = {
  colConcepto:    ['SALDO ACUMULADO', 'ANDE', 'TODO BRILLO S.A.', 'CGI S.R.L.', 'TOTAL GASTOS DEL MES'],
  colDescripcion: ['', 'CONSUMO CICLO 03/26', 'SERVICIO DE LIMPIEZA', 'CAMBIO DE BARRERA', ''],
  colReserva:     ['', '', '', '2.640.000', '2.640.000'],
  colMonto:       ['2.500.000', '3.150.000', '11.290.000', '', '37.180.000']
};

const ROWS_KEY = 'filas'; // guarda el alto de fila comun de las cuatro columnas
const DEFAULT_ROW_HEIGHT = 15;

const PAGE_W_PT = 595.2756;
const PAGE_H_PT = 841.8898;
const SCALE = 0.72; // px por punto PDF

@Component({
  standalone: true,
  selector: 'app-settlement-calibration-page',
  imports: [CommonModule, FormsModule, RouterLink, Button, Card],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-page-head">
        <div>
          <h1>Ajustar liquidación</h1>
          <p *ngIf="building">{{ building.name }} · modelo de liquidación propio</p>
        </div>
        <a routerLink="/buildings" style="display:contents">
          <p-button label="Volver a edificios" icon="pi pi-arrow-left" severity="secondary" [text]="true"></p-button>
        </a>
      </div>

      <p class="app-state" *ngIf="loading">Cargando...</p>

      <p class="app-state" *ngIf="!loading && building && !templateUrl">
        Este edificio no tiene un modelo de liquidación propio cargado. El superadmin lo adjunta en la ficha del edificio.
      </p>

      <ng-container *ngIf="!loading && building && templateUrl">
        <div class="calib-toolbar">
          <p-button label="Reiniciar posiciones" icon="pi pi-refresh" severity="secondary" [text]="true" (onClick)="resetAll()"></p-button>
          <span class="spacer"></span>
          <p-button label="Generar PDF de prueba" icon="pi pi-file-pdf" severity="secondary" [outlined]="true" (onClick)="openSamplePdf()"></p-button>
          <p-button label="Guardar posiciones" icon="pi pi-check" [loading]="saving" (onClick)="save()"></p-button>
        </div>

        <p class="calib-hint">
          Arrastrá cada bloque hasta que calce sobre el modelo. Cada columna del cuerpo (concepto, descripción y montos) se
          mueve y se ensancha por separado, y el alto de fila se ajusta para que las filas caigan sobre las líneas del papel.
          Cada renglón ocupa una sola línea (si el texto no entra en el ancho se corta con "..."). Los datos son de ejemplo.
          Después de guardar, generá el PDF de prueba e imprimilo sobre el papel para verificar.
        </p>

        <div class="calib-options">
          <label class="hide-frame-check">
            <input type="checkbox" [(ngModel)]="hideFrame" name="hideFrame" [ngModelOptions]="{ standalone: true }" />
            Mi modelo ya tiene su propio marco, fondos y líneas impresos — dibujar solo el texto.
          </label>
          <span class="row-height">
            Alto de cada fila
            <button type="button" class="font-step" (click)="stepRowHeight(-0.5)">−</button>
            <input type="number" step="0.5" min="6" max="80" class="font-input"
                   [ngModel]="rowHeight" (ngModelChange)="setRowHeight($event)" [ngModelOptions]="{ standalone: true }" />
            <button type="button" class="font-step" (click)="stepRowHeight(0.5)">+</button>
            pt
          </span>
        </div>

        <div class="calib-workspace">
          <div class="calib-list calib-side">
            <ng-container *ngTemplateOutlet="rowTpl; context: { fields: leftFields }"></ng-container>
          </div>

          <div class="calib-canvas" [style.width.px]="canvasW" [style.height.px]="canvasH">
            <img *ngIf="!isPdf" [src]="resolvedTemplateUrl" class="calib-bg" [style.width.px]="canvasW" [style.height.px]="canvasH" alt="Modelo de liquidación" />
            <iframe *ngIf="isPdf" [src]="resolvedTemplateUrlSafe" class="calib-bg" [style.width.px]="canvasW" [style.height.px]="canvasH" title="Modelo de liquidación"></iframe>

            <ng-container *ngFor="let f of fields">
              <div class="calib-field" *ngIf="!isHidden(f)"
                   [style.left.px]="screenX(f)" [style.top.px]="screenY(f)"
                   [style.fontSize.px]="fontSizeOf(f) * SCALE"
                   [style.width.px]="widthOf(f) ? widthOf(f) * SCALE : null"
                   [style.height.px]="heightOf(f)"
                   [style.textAlign]="alignOf(f)"
                   [class.calib-block]="f.kind !== 'text'"
                   [class.dragging]="draggingKey === f.key"
                   (mousedown)="startDrag(f, $event)">
                <ng-container [ngSwitch]="f.kind">
                  <ng-container *ngSwitchCase="'text'">{{ f.sample }}</ng-container>
                  <ng-container *ngSwitchCase="'column'">
                    <div class="mock-cell" *ngFor="let text of samplesOf(f)"
                         [style.textAlign]="alignOf(f)"
                         [style.height.px]="rowHeight * SCALE" [style.lineHeight.px]="rowHeight * SCALE">{{ text }}</div>
                  </ng-container>
                  <div *ngSwitchCase="'image'" class="mock-sign-img">{{ f.sample }}</div>
                </ng-container>
              </div>
            </ng-container>
          </div>

          <div class="calib-list calib-side">
            <ng-container *ngTemplateOutlet="rowTpl; context: { fields: rightFields }"></ng-container>
          </div>
        </div>

        <ng-template #rowTpl let-fields="fields">
          <ng-container *ngFor="let f of fields; let i = index">
          <div class="calib-group" *ngIf="i === 0 || fields[i - 1].group !== f.group">{{ f.group }}</div>
          <div class="calib-row" [class.is-hidden]="isHidden(f)">
            <span class="calib-row-label">{{ f.label }}</span>
            <span class="calib-row-offset">dx {{ (offsets[f.key]?.dx ?? 0) | number:'1.0-1' }} · dy {{ (offsets[f.key]?.dy ?? 0) | number:'1.0-1' }} pt</span>
            <span class="calib-row-fontsize" *ngIf="f.kind !== 'image'">
              letra
              <button type="button" class="font-step" (click)="stepFontSize(f, -0.5)">−</button>
              <input type="number" step="0.5" min="4" max="60" class="font-input"
                     [ngModel]="fontSizeOf(f)" (ngModelChange)="setFontSize(f, $event)" [ngModelOptions]="{ standalone: true }" />
              <button type="button" class="font-step" (click)="stepFontSize(f, 0.5)">+</button>
              pt
            </span>
            <span class="calib-row-fontsize" *ngIf="f.width">
              ancho
              <button type="button" class="font-step" (click)="stepWidth(f, -5)">−</button>
              <input type="number" step="1" min="10" max="600" class="font-input wide"
                     [ngModel]="widthOf(f)" (ngModelChange)="setWidth(f, $event)" [ngModelOptions]="{ standalone: true }" />
              <button type="button" class="font-step" (click)="stepWidth(f, 5)">+</button>
              pt
            </span>
            <label class="hide-check">
              <input type="checkbox" [ngModel]="isHidden(f)" (ngModelChange)="setHidden(f, $event)" [ngModelOptions]="{ standalone: true }" />
              No dibujar (mi papel ya lo trae impreso)
            </label>
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
    .calib-hint { font-size: 0.82rem; color: #6b878d; margin: 0 0 1rem; }
    .calib-options { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .hide-frame-check {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.85rem; color: #29484f; font-weight: 600; cursor: pointer;
    }
    .hide-frame-check input { width: auto; }
    .row-height { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: #29484f; font-weight: 600; }
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
    /* contain sobre el lienzo A4, igual que el PDF (FitArea): si la proporcion de la imagen no es A4 queda
       con el mismo margen en blanco que va a tener el PDF, asi lo que se ve aca es lo que sale impreso. */
    .calib-bg { position: absolute; top: 0; left: 0; object-fit: contain; object-position: top left; pointer-events: none; border: 0; }
    .calib-field {
      position: absolute;
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
    .calib-field { box-sizing: border-box; }
    .calib-field.calib-block { white-space: normal; overflow: hidden; }
    .calib-field.dragging { cursor: grabbing; background: rgba(19,133,182,0.25); z-index: 10; }
    .mock-cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mock-sign-img { height: 100%; display: flex; align-items: flex-end; justify-content: center; opacity: 0.5; }
    .calib-group { margin-top: 0.6rem; padding: 0.2rem 0.5rem; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #1385b6; }
    .calib-list { display: grid; gap: 0.25rem; align-content: start; }
    .calib-side { flex: 1 1 0; min-width: 0; max-width: 250px; }
    .calib-row {
      display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem;
      padding: 0.4rem 0.5rem; border-bottom: 1px solid #eef3f2; font-size: 0.78rem;
    }
    .calib-row.is-hidden { opacity: 0.55; }
    .calib-row-label { color: #29484f; font-weight: 600; }
    .calib-row-offset { color: #6b878d; font-variant-numeric: tabular-nums; }
    .calib-row-fontsize { display: flex; align-items: center; gap: 0.3rem; color: #6b878d; white-space: nowrap; }
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
    @media (max-width: 1000px) {
      .calib-workspace { flex-direction: column; align-items: center; }
      .calib-side { max-width: 100%; width: 100%; }
    }
  `]
})
export class SettlementCalibrationPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly buildingsApi = inject(BuildingsApiService);
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

  building: Building | null = null;
  templateUrl: string | null = null;
  loading = true;
  saving = false;
  offsets: Record<string, FieldOffset> = {};
  hideFrame = true;

  get resolvedTemplateUrl(): string { return resolveUploadUrl(this.templateUrl); }
  get resolvedTemplateUrlSafe(): SafeResourceUrl { return this.sanitizer.bypassSecurityTrustResourceUrl(this.resolvedTemplateUrl); }
  get isPdf(): boolean { return isPdfUrl(this.templateUrl); }

  private draggingField: CalibField | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragBaseDx = 0;
  private dragBaseDy = 0;
  draggingKey: string | null = null;

  private readonly onMouseMove = (event: MouseEvent) => this.handleMouseMove(event);
  private readonly onMouseUp = () => this.handleMouseUp();

  ngOnInit(): void {
    // Solo quien administra el edificio (empresa o encargado) la ajusta; el backend tambien lo valida.
    if (!this.auth.hasRole('CompanyAdmin', 'BuildingManager')) {
      this.router.navigate(['/']);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.buildingsApi.getById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (found) => {
        this.applyBuilding(found);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo cargar el edificio.'), life: 5000 });
        this.router.navigate(['/buildings']);
      }
    });
  }

  private applyBuilding(found: Building): void {
    this.building = found;
    this.templateUrl = found.useStandardTemplates === false ? (found.settlementTemplateUrl ?? null) : null;
    this.offsets = this.parseOffsets(found.settlementFieldPositionsJson);
    this.hideFrame = found.settlementHideFrame ?? true;
  }

  // El backend guarda en camelCase; se acepta tambien PascalCase por si quedo algo guardado de otra forma.
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
          rowHeight: (pick(value, 'rowHeight') ?? null) as number | null,
          hidden: Boolean(pick(value, 'hidden') ?? false)
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

  screenX(f: CalibField): number {
    return (f.x + (this.offsets[f.key]?.dx ?? 0)) * SCALE;
  }

  screenY(f: CalibField): number {
    return (f.top - (this.offsets[f.key]?.dy ?? 0)) * SCALE;
  }

  fontSizeOf(f: CalibField): number {
    return this.offsets[f.key]?.fontSize ?? f.defaultFontSize;
  }

  widthOf(f: CalibField): number {
    return this.offsets[f.key]?.width ?? f.width;
  }

  // Alto del bloque solo para la imagen de la firma (los demas toman el de su contenido).
  heightOf(f: CalibField): number | null {
    return f.kind === 'image' ? IMAGE_H_PT * SCALE : null;
  }

  alignOf(f: CalibField): string | null {
    return f.align === 'R' ? 'right' : f.align === 'C' ? 'center' : null;
  }

  isHidden(f: CalibField): boolean {
    return this.offsets[f.key]?.hidden === true;
  }

  samplesOf(f: CalibField): string[] {
    return COLUMN_SAMPLES[f.key as ColumnKey] ?? [];
  }

  get rowHeight(): number {
    return this.offsets[ROWS_KEY]?.rowHeight ?? DEFAULT_ROW_HEIGHT;
  }

  setRowHeight(value: number): void {
    if (!value || value < 6 || value > 80) return;
    this.patch(ROWS_KEY, { rowHeight: value });
  }

  stepRowHeight(delta: number): void {
    this.setRowHeight(Math.round((this.rowHeight + delta) * 2) / 2);
  }

  setFontSize(f: CalibField, value: number): void {
    if (!value || value <= 0) return;
    this.patch(f.key, { fontSize: value });
  }

  stepFontSize(f: CalibField, delta: number): void {
    this.setFontSize(f, Math.max(4, Math.round((this.fontSizeOf(f) + delta) * 2) / 2));
  }

  setWidth(f: CalibField, value: number): void {
    if (!value || value < 10 || value > 600) return;
    this.patch(f.key, { width: value });
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
    const dx = this.dragBaseDx + (event.clientX - this.dragStartX) / SCALE;
    const dy = this.dragBaseDy - (event.clientY - this.dragStartY) / SCALE; // pantalla abajo = dy negativo
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
    if (!confirm('¿Reiniciar todas las posiciones, anchos y el alto de fila a los valores por defecto?')) return;
    this.offsets = {};
  }

  save(): void {
    if (!this.building) return;
    this.saving = true;
    this.buildingsApi.updateSettlementPositions(this.building.id, { positions: this.offsets, hideFrame: this.hideFrame })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (updated) => {
          this.applyBuilding(updated);
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

  // El backend genera el PDF de prueba con lo que ya esta guardado, no con lo que esta en pantalla sin
  // guardar — por eso hay que guardar antes de abrirlo.
  openSamplePdf(): void {
    if (!this.building) return;
    this.saving = true;
    this.buildingsApi.updateSettlementPositions(this.building.id, { positions: this.offsets, hideFrame: this.hideFrame })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (updated) => {
          this.applyBuilding(updated);
          this.saving = false;
          this.cdr.markForCheck();
          window.open(this.buildingsApi.getSettlementSamplePdfUrl(updated.id, this.auth.getToken() ?? ''), '_blank');
        },
        error: (error) => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron guardar las posiciones.'), life: 5000 });
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }
}
