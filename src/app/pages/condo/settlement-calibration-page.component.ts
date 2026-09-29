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

type BlockKind = 'text' | 'columns' | 'body' | 'control' | 'signatures' | 'footer';

interface CalibField {
  key: string;
  label: string;
  kind: BlockKind;
  sample: string;
  x: number;   // punto PDF, desde la esquina superior izquierda (igual que SettlementPdfDocument.cs)
  top: number;
  width: number; // ancho del bloque en puntos (solo bloques; el texto va en una linea)
  defaultFontSize: number; // debe coincidir con el tamano por defecto en SettlementPdfDocument.cs
}

// Mismas keys, posiciones y tamanos base que FieldDefaults en SettlementPdfDocument.cs — si se agrega un
// bloque calibrable ahi, hay que agregarlo aca tambien para poder arrastrarlo.
const FIELDS: CalibField[] = [
  { key: 'titulo',   label: 'Título',                       kind: 'text',       sample: 'LIQUIDACIÓN EXPENSAS COMUNES', x: 195, top: 86,  width: 0,   defaultFontSize: 11 },
  { key: 'edificio', label: 'Edificio',                     kind: 'text',       sample: 'EDIFICIO DE EJEMPLO',           x: 66,  top: 100, width: 0,   defaultFontSize: 8 },
  { key: 'periodo',  label: 'Mes / período',                kind: 'text',       sample: 'MES: ABRIL 2026',               x: 215, top: 112, width: 0,   defaultFontSize: 10 },
  { key: 'columnas', label: 'Títulos de las 2 columnas',    kind: 'columns',    sample: '',                               x: 385, top: 128, width: 160, defaultFontSize: 6.5 },
  { key: 'cuerpo',   label: 'Cuerpo (ingresos, gastos y totales)', kind: 'body', sample: '',                             x: 50,  top: 145, width: 495, defaultFontSize: 8 },
  { key: 'control',  label: 'Control (emisión, vigencia y vencimiento)', kind: 'control', sample: '',                    x: 60,  top: 668, width: 260, defaultFontSize: 8 },
  { key: 'firmas',   label: 'Firmas',                       kind: 'signatures', sample: '',                               x: 50,  top: 725, width: 495, defaultFontSize: 9 },
  { key: 'pie',      label: 'Pie (generado y N° de hoja)',  kind: 'footer',     sample: '',                               x: 50,  top: 815, width: 495, defaultFontSize: 7 }
];

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
          Arrastrá cada bloque hasta que calce sobre el modelo. Los datos son de ejemplo (no es una liquidación real).
          Después de guardar, generá el PDF de prueba e imprimilo sobre el papel para verificar.
          El cuerpo crece hacia abajo según la cantidad de gastos y, si no entra en la hoja, sigue en la siguiente.
        </p>

        <label class="hide-frame-check">
          <input type="checkbox" [(ngModel)]="hideFrame" name="hideFrame" [ngModelOptions]="{ standalone: true }" />
          Mi modelo ya tiene su propio marco, fondos y líneas impresos — dibujar solo el texto.
        </label>

        <div class="calib-workspace">
          <div class="calib-list calib-side">
            <ng-container *ngTemplateOutlet="rowTpl; context: { fields: leftFields }"></ng-container>
          </div>

          <div class="calib-canvas" [style.width.px]="canvasW" [style.height.px]="canvasH">
            <img *ngIf="!isPdf" [src]="resolvedTemplateUrl" class="calib-bg" [style.width.px]="canvasW" [style.height.px]="canvasH" alt="Modelo de liquidación" />
            <iframe *ngIf="isPdf" [src]="resolvedTemplateUrlSafe" class="calib-bg" [style.width.px]="canvasW" [style.height.px]="canvasH" title="Modelo de liquidación"></iframe>

            <div class="calib-field" *ngFor="let f of fields"
                 [style.left.px]="screenX(f)" [style.top.px]="screenY(f)"
                 [style.fontSize.px]="fontSizeOf(f) * SCALE"
                 [style.width.px]="f.width ? f.width * SCALE : null"
                 [class.calib-block]="f.kind !== 'text'"
                 [class.dragging]="draggingKey === f.key"
                 (mousedown)="startDrag(f, $event)">
              <ng-container [ngSwitch]="f.kind">
                <ng-container *ngSwitchCase="'text'">{{ f.sample }}</ng-container>
                <div *ngSwitchCase="'columns'" class="mock-cols"><b>FONDOS DE RESERVA</b><b>GASTOS COMUNES</b></div>
                <div *ngSwitchCase="'body'" class="mock-body">
                  <div class="mock-row"><span>SALDO ACUMULADO</span><span></span><span>2.500.000</span></div>
                  <div class="mock-row"><span><b>TOTAL PARA GASTOS</b></span><span></span><span><b>3.400.000</b></span></div>
                  <div class="mock-row gap"></div>
                  <div class="mock-row"><span>ANDE · CONSUMO CICLO 03/26</span><span></span><span>3.150.000</span></div>
                  <div class="mock-row"><span>TODO BRILLO · LIMPIEZA</span><span></span><span>11.290.000</span></div>
                  <div class="mock-row"><span>CGI · CAMBIO DE BARRERA</span><span>2.640.000</span><span></span></div>
                  <div class="mock-row"><span>… un gasto por línea …</span><span></span><span></span></div>
                  <div class="mock-row gap"></div>
                  <div class="mock-row"><span><b>TOTAL GASTOS DEL MES</b></span><span><b>2.640.000</b></span><span><b>37.180.000</b></span></div>
                  <div class="mock-row"><span><b>MONTO NETO A DISTRIBUIR</b></span><span></span><span><b>40.190.000</b></span></div>
                </div>
                <div *ngSwitchCase="'control'">
                  <div>Fecha de emisión: 30/04/2026</div>
                  <div>Vigencia: 01/04/2026 al 30/04/2026</div>
                  <div>Vencimiento: 20/05/2026</div>
                </div>
                <div *ngSwitchCase="'signatures'" class="mock-sign">
                  <span>Nombre Apellido<br />Administrador</span>
                  <span>Nombre Apellido<br />Presidente del consorcio</span>
                </div>
                <div *ngSwitchCase="'footer'" class="mock-foot"><span>Generado el 30/04/2026</span><span>1 / 1</span></div>
              </ng-container>
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
    /* fit contain sobre el lienzo A4, igual que el PDF (FitArea): si la proporcion de la imagen no es A4 queda
       con el mismo margen en blanco que va a tener el PDF, asi lo que se ve aca es lo que sale impreso. */
    .calib-bg { position: absolute; top: 0; left: 0; object-fit: contain; object-position: top left; pointer-events: none; border: 0; }
    .calib-field {
      position: absolute;
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
    .calib-field.calib-block { white-space: normal; box-sizing: border-box; overflow: hidden; }
    .calib-field.dragging { cursor: grabbing; background: rgba(19,133,182,0.25); z-index: 10; }
    .mock-cols { display: flex; }
    .mock-cols b { flex: 0 0 50%; text-align: center; }
    .mock-row { display: grid; grid-template-columns: 1fr 16% 16%; gap: 2px; }
    .mock-row span:nth-child(2), .mock-row span:nth-child(3) { text-align: right; }
    .mock-row.gap { height: 0.6em; }
    .mock-sign { display: flex; justify-content: space-around; text-align: center; }
    .mock-foot { display: flex; justify-content: space-between; }
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
      const raw = JSON.parse(json) as Record<string, Record<string, number | null>>;
      const result: Record<string, FieldOffset> = {};
      for (const [key, value] of Object.entries(raw)) {
        result[key] = {
          dx: Number(value['dx'] ?? value['Dx'] ?? 0),
          dy: Number(value['dy'] ?? value['Dy'] ?? 0),
          fontSize: (value['fontSize'] ?? value['FontSize'] ?? null) as number | null
        };
      }
      return result;
    } catch {
      return {};
    }
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
    const dx = this.dragBaseDx + (event.clientX - this.dragStartX) / SCALE;
    const dy = this.dragBaseDy - (event.clientY - this.dragStartY) / SCALE; // pantalla abajo = dy negativo
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
