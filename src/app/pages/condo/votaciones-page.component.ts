import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Select } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { VotesApiService } from '../../api/votes-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { Building, Vote, VoteStatus, VoteWeightType, VoteUpsertRequest, VoteCastRequest, VoteUnitSummary, VoteOptionDto } from '../../api/models';
import { extractApiErrorMessage } from '../../api/api-error.util';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
type PanelMode = 'form' | 'results';

const STATUS_LABEL: Record<VoteStatus, string> = { Draft: 'Borrador', Open: 'Abierta', Closed: 'Cerrada' };
const STATUS_SEVERITY: Record<VoteStatus, TagSeverity> = { Draft: 'secondary', Open: 'success', Closed: 'contrast' };

@Component({
  standalone: true,
  selector: 'app-votaciones-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag, Select],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Votaciones</h1>
            <p>Gestión de votaciones formales con quórum y resultados ponderados.</p>
          </div>
        </div>
        <div class="toolbar-actions">
          <p-button label="Nueva votación" icon="pi pi-plus" (onClick)="openCreate()"></p-button>
        </div>
      </div>

      <div class="filter-bar" *ngIf="buildings.length > 1">
        <label class="filter-label">Edificio:</label>
        <p-select [options]="buildingOptions" [(ngModel)]="selectedBuildingId" optionLabel="label"
                  optionValue="value" placeholder="Todos los edificios"
                  [showClear]="true" (onChange)="onBuildingFilter()"
                  styleClass="filter-select"></p-select>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando votaciones...</p>
      <p class="app-state" *ngIf="!loading && !pageError && !filteredItems.length">No hay votaciones registradas.</p>

      <div class="app-list" *ngIf="filteredItems.length">
        <div class="app-row header vote-grid" [class.has-building]="buildings.length > 1">
          <span>Título</span>
          <span>Estado</span>
          <span *ngIf="buildings.length > 1">Edificio</span>
          <span>Quórum</span>
          <span>Participación</span>
          <span>Creada</span>
        </div>
        <div class="app-row vote-grid" [class.has-building]="buildings.length > 1" *ngFor="let v of filteredItems">
          <button class="row-link" (click)="openResults(v)">{{ v.title }}</button>
          <p-tag [value]="statusLabel(v.status)" [severity]="statusSeverity(v.status)"></p-tag>
          <span *ngIf="buildings.length > 1" class="building-label">{{ v.buildingName }}</span>
          <span class="quorum-cell" [class.q-ok]="v.quorumReached" [class.q-no]="!v.quorumReached && v.status !== 'Draft'">
            {{ v.quorumPercentage }}%
            <span *ngIf="v.status !== 'Draft'" class="pi"
                  [class.pi-check-circle]="v.quorumReached"
                  [class.pi-times-circle]="!v.quorumReached"></span>
          </span>
          <span class="part-cell">{{ v.participatingUnits }}/{{ v.totalUnits }}</span>
          <span>{{ formatDate(v.createdAtUtc) }}</span>
        </div>
      </div>
    </p-card>

    <!-- ══ BACKDROP ══════════════════════════════════════════ -->
    <div class="ov-backdrop" *ngIf="panelVisible" (click)="closePanel()"></div>

    <!-- ══ PANEL FORM (Borrador: crear / editar) ═════════════ -->
    <div class="ov-panel" *ngIf="panelVisible && panelMode === 'form'" (click)="$event.stopPropagation()">

      <div class="panel-header" [class.mode-edit]="!!selectedVote">
        <div class="panel-header-icon">
          <span class="pi" [class.pi-plus-circle]="!selectedVote" [class.pi-pencil]="!!selectedVote"></span>
        </div>
        <div class="panel-header-text">
          <h2>{{ selectedVote ? 'Editar votación' : 'Nueva votación' }}</h2>
          <p>{{ selectedVote ? 'Ajusta los parámetros (solo en Borrador)' : 'Configura antes de abrir a votación' }}</p>
        </div>
        <button class="ov-close" type="button" (click)="closePanel()">
          <span class="pi pi-times"></span>
        </button>
      </div>

      <form class="panel-form" (ngSubmit)="save()">

        <!-- Edificio -->
        <div class="form-section">
          <div class="section-label"><span class="pi pi-home"></span> Edificio</div>
          <div *ngIf="selectedVote" class="dest-chip">
            <span class="pi pi-building"></span> {{ selectedVote.buildingName }}
          </div>
          <div *ngIf="!selectedVote" class="dest-create">
            <select class="dest-select" [(ngModel)]="form.buildingId" name="buildingId" required>
              <option value="" disabled>Selecciona un edificio</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
          </div>
        </div>

        <!-- Contenido -->
        <div class="form-section">
          <div class="section-label"><span class="pi pi-align-left"></span> Contenido</div>
          <div class="field">
            <label class="field-label">Título</label>
            <div class="input-wrap">
              <input class="field-input" [(ngModel)]="form.title" name="title"
                     required maxlength="200" placeholder="Ej: Elección de administrador 2025" />
              <span class="char-count" [class.char-warn]="form.title.length > 170">{{ form.title.length }}/200</span>
            </div>
          </div>
          <div class="field">
            <label class="field-label">
              Descripción <span class="field-optional">(opcional)</span>
            </label>
            <textarea class="field-textarea" [(ngModel)]="form.description" name="description"
                      rows="3" placeholder="Contexto adicional sobre el tema a votar..."></textarea>
          </div>
        </div>

        <!-- Configuración -->
        <div class="form-section">
          <div class="section-label"><span class="pi pi-sliders-h"></span> Configuración</div>
          <div class="config-row">
            <div class="field field-sm">
              <label class="field-label">Quórum requerido</label>
              <div class="quorum-input-wrap">
                <input class="field-input quorum-input" type="number"
                       [(ngModel)]="form.quorumPercentage" name="quorumPercentage"
                       min="1" max="100" required />
                <span class="quorum-pct">%</span>
              </div>
            </div>
            <div class="field field-grow">
              <label class="field-label">Peso del voto</label>
              <div class="weight-toggle">
                <button type="button" class="weight-btn" [class.active]="form.weightType === 'ByUnit'"
                        (click)="form.weightType = 'ByUnit'">
                  <span class="pi pi-hashtag"></span> Por unidad
                </button>
                <button type="button" class="weight-btn" [class.active]="form.weightType === 'ByCoefficient'"
                        (click)="form.weightType = 'ByCoefficient'">
                  <span class="pi pi-percentage"></span> Por coeficiente
                </button>
              </div>
            </div>
          </div>
          <p class="config-hint">
            <span class="pi pi-info-circle"></span>
            {{ form.weightType === 'ByCoefficient'
               ? 'El peso del voto es proporcional al coeficiente de la unidad.'
               : 'Cada unidad vale 1 voto, sin importar su coeficiente.' }}
          </p>
        </div>

        <!-- Opciones -->
        <div class="form-section">
          <div class="section-label">
            <span class="pi pi-list"></span> Opciones de votación
            <span class="section-optional">mín. 2</span>
          </div>

          <div class="options-list">
            <div class="option-row" *ngFor="let opt of optionLabels; let i = index; trackBy: trackByIdx">
              <div class="option-badge">{{ i + 1 }}</div>
              <input class="field-input option-input" [(ngModel)]="optionLabels[i]" [name]="'opt' + i"
                     placeholder="Ej: A favor" maxlength="100" />
              <button type="button" class="option-remove" (click)="removeOption(i)"
                      [disabled]="optionLabels.length <= 2" title="Eliminar opción">
                <span class="pi pi-times"></span>
              </button>
            </div>
          </div>

          <button type="button" class="add-option-btn" (click)="addOption()" [disabled]="optionLabels.length >= 10">
            <span class="pi pi-plus-circle"></span> Agregar opción
          </button>
        </div>

        <p-message *ngIf="formError" severity="error" [text]="formError" styleClass="w-full"></p-message>

        <div class="panel-footer">
          <p-button *ngIf="selectedVote" type="button" label="Eliminar" severity="danger"
                    [outlined]="true" icon="pi pi-trash" [loading]="saving" (onClick)="deleteVote()"></p-button>
          <div *ngIf="!selectedVote"></div>
          <p-button type="submit" [label]="selectedVote ? 'Guardar cambios' : 'Crear votación'"
                    [icon]="selectedVote ? 'pi pi-check' : 'pi pi-plus'" [loading]="saving"></p-button>
        </div>
      </form>
    </div>

    <!-- ══ PANEL RESULTADOS (Abierta / Cerrada / Borrador) ═══ -->
    <div class="ov-panel ov-panel-lg" *ngIf="panelVisible && panelMode === 'results'" (click)="$event.stopPropagation()">

      <div class="panel-header"
           [class.mode-open]="detail?.status === 'Open'"
           [class.mode-closed]="detail?.status === 'Closed'"
           [class.mode-draft]="detail?.status === 'Draft' || !detail">
        <div class="panel-header-icon">
          <span class="pi"
                [class.pi-chart-bar]="detail?.status === 'Open'"
                [class.pi-lock]="detail?.status === 'Closed'"
                [class.pi-file-edit]="detail?.status === 'Draft' || !detail"></span>
        </div>
        <div class="panel-header-text">
          <h2>{{ detail?.title ?? 'Cargando...' }}</h2>
          <p *ngIf="detail">{{ detail.buildingName }} · Quórum {{ detail.quorumPercentage }}% · {{ weightLabel(detail.weightType) }}</p>
        </div>
        <button class="ov-close" type="button" (click)="closePanel()">
          <span class="pi pi-times"></span>
        </button>
      </div>

      <div class="results-loading" *ngIf="!detail && !panelError">
        <span class="pi pi-spin pi-spinner"></span> Cargando detalle...
      </div>

      <p-message *ngIf="panelError" severity="error" [text]="panelError" styleClass="m-3"></p-message>

      <div class="results-body" *ngIf="detail">

        <!-- Barra de estado + acciones -->
        <div class="status-bar">
          <p-tag [value]="statusLabel(detail.status)" [severity]="statusSeverity(detail.status)"></p-tag>
          <div class="status-actions">
            <p-button *ngIf="detail.status === 'Draft'" label="Editar" icon="pi pi-pencil"
                      severity="secondary" [outlined]="true" (onClick)="switchToEdit()"></p-button>
            <p-button *ngIf="detail.status === 'Draft'" label="Abrir votación" icon="pi pi-lock-open"
                      severity="success" [loading]="transitioning" (onClick)="openVote()"></p-button>
            <p-button *ngIf="detail.status === 'Open'" label="Cerrar votación" icon="pi pi-lock"
                      severity="warn" [loading]="transitioning" (onClick)="closeVote()"></p-button>
          </div>
        </div>

        <!-- Quórum summary -->
        <div class="quorum-summary">
          <div class="qs-stat">
            <span class="qs-num">{{ detail.participatingUnits }}/{{ detail.totalUnits }}</span>
            <span class="qs-lbl">Participantes</span>
          </div>
          <div class="qs-div"></div>
          <div class="qs-stat">
            <span class="qs-num">
              {{ detail.totalUnits > 0 ? (detail.participatingUnits * 100 / detail.totalUnits | number:'1.1-1') : 0 }}%
            </span>
            <span class="qs-lbl">Participación</span>
          </div>
          <div class="qs-div"></div>
          <div class="qs-stat">
            <span class="qs-num" [class.q-ok]="detail.quorumReached" [class.q-no]="!detail.quorumReached">
              <span class="pi" [class.pi-check-circle]="detail.quorumReached"
                               [class.pi-times-circle]="!detail.quorumReached"></span>
              {{ detail.quorumReached ? 'Alcanzado' : 'Sin quórum' }}
            </span>
            <span class="qs-lbl">Quórum ({{ detail.quorumPercentage }}%)</span>
          </div>
        </div>

        <!-- Resultados por opción -->
        <div class="results-section">
          <div class="results-title"><span class="pi pi-chart-bar"></span> Resultados</div>
          <div *ngIf="detail.options.length === 0" class="empty-hint">Aún no hay opciones definidas.</div>
          <div class="option-result" *ngFor="let opt of detail.options">
            <div class="opt-header">
              <span class="opt-label">{{ opt.label }}</span>
              <span class="opt-stats">{{ opt.castCount }} voto(s) · {{ opt.percentage | number:'1.1-1' }}%</span>
            </div>
            <div class="opt-bar-track">
              <div class="opt-bar-fill" [style.width.%]="opt.percentage"
                   [class.bar-winner]="isWinner(opt)"></div>
            </div>
          </div>
        </div>

        <!-- Unidades -->
        <div class="units-section" *ngIf="detail.status !== 'Draft'">
          <div class="results-title">
            <span class="pi pi-building"></span> Unidades
            <span class="units-hint" *ngIf="detail.status === 'Open'">
              · Haz clic en una opción para registrar el voto
            </span>
          </div>
          <div class="units-list">
            <div class="unit-row" *ngFor="let u of detail.units"
                 [class.unit-voted]="u.castId"
                 [class.unit-pending]="!u.castId">
              <div class="unit-info">
                <span class="unit-code">{{ u.unitCode }}</span>
                <span class="unit-coeff">({{ u.coefficient | number:'1.2-4' }})</span>
                <span class="unit-badge voted" *ngIf="u.castId">
                  <span class="pi pi-check"></span> {{ u.votedOptionLabel }}
                </span>
                <span class="unit-badge pending" *ngIf="!u.castId">Sin votar</span>
              </div>
              <div class="unit-cast-actions" *ngIf="detail.status === 'Open'">
                <button *ngFor="let opt of detail.options" type="button"
                        class="cast-btn" [class.cast-active]="u.votedOptionId === opt.id"
                        [disabled]="castingUnitId === u.unitId"
                        (click)="castVote(u, opt)">
                  {{ opt.label }}
                </button>
                <button *ngIf="u.castId" type="button" class="cast-remove-btn"
                        [disabled]="castingUnitId === u.unitId"
                        title="Quitar voto" (click)="removeCast(u)">
                  <span class="pi pi-times"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    /* ══ Toolbar / filtro ═══════════════════════════════════ */
    .toolbar-actions { display: flex; gap: 0.5rem; }
    .filter-bar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .filter-label { font-weight: 600; font-size: .9rem; color: var(--brand-ink); white-space: nowrap; }
    .filter-select { min-width: 220px; }
    .app-state { color: var(--brand-muted); text-align: center; padding: 24px; }

    /* ══ Lista ══════════════════════════════════════════════ */
    .vote-grid { grid-template-columns: 2fr 90px 80px 80px 80px; }
    .vote-grid.has-building { grid-template-columns: 2fr 90px 120px 80px 80px 80px; }
    .row-link {
      background: none; border: none; padding: 0; font: inherit; font-weight: 700;
      color: var(--brand-blue); cursor: pointer; text-align: left;
      text-decoration: underline dotted; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap;
    }
    .row-link:hover { color: var(--brand-ink); }
    .building-label { color: var(--brand-blue); font-weight: 600; font-size: .88rem; }
    .quorum-cell { display: flex; align-items: center; gap: 4px; font-weight: 600; font-size: .88rem; }
    .part-cell { font-variant-numeric: tabular-nums; font-size: .88rem; }
    .q-ok { color: #059669; }
    .q-no { color: #dc2626; }

    /* ══ Overlay ════════════════════════════════════════════ */
    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(10,25,45,.5);
      z-index: 1000; backdrop-filter: blur(3px); animation: fadeIn .15s ease;
    }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(600px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 20px; z-index: 1001;
      box-shadow: 0 40px 100px rgba(10,30,60,.3), 0 0 0 1px rgba(19,133,182,.08);
      animation: slideUp .22s cubic-bezier(.4,0,.2,1);
      display: flex; flex-direction: column;
    }
    .ov-panel-lg { width: min(680px, calc(100vw - 2rem)); }

    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp {
      from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)); }
      to   { opacity: 1; transform: translate(-50%, -50%); }
    }

    /* ══ Panel header ═══════════════════════════════════════ */
    .panel-header {
      display: flex; align-items: flex-start; gap: 1rem;
      padding: 1.4rem 1.6rem 1.2rem;
      background: linear-gradient(135deg, rgba(19,133,182,.06) 0%, transparent 70%);
      border-bottom: 1px solid rgba(19,133,182,.1);
      flex-shrink: 0;
    }
    .panel-header.mode-edit    { background: linear-gradient(135deg, rgba(217,119,6,.07) 0%, transparent 70%); border-bottom-color: rgba(217,119,6,.12); }
    .panel-header.mode-open    { background: linear-gradient(135deg, rgba(5,150,105,.07) 0%, transparent 70%); border-bottom-color: rgba(5,150,105,.12); }
    .panel-header.mode-closed  { background: linear-gradient(135deg, rgba(100,116,139,.07) 0%, transparent 70%); border-bottom-color: rgba(100,116,139,.1); }

    .panel-header-icon {
      width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
      background: rgba(19,133,182,.12); color: var(--brand-blue);
      display: grid; place-items: center; font-size: 1.1rem;
    }
    .mode-edit   .panel-header-icon { background: rgba(217,119,6,.12); color: #B45309; }
    .mode-open   .panel-header-icon { background: rgba(5,150,105,.12); color: #059669; }
    .mode-closed .panel-header-icon { background: rgba(100,116,139,.12); color: #64748B; }

    .panel-header-text { flex: 1; min-width: 0; }
    .panel-header-text h2 { margin: 0 0 .2rem; font-size: 1.05rem; font-weight: 700; color: var(--brand-ink); }
    .panel-header-text p  { margin: 0; font-size: .8rem; color: var(--brand-muted); }

    .ov-close {
      background: none; border: none; cursor: pointer;
      color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center; transition: background .15s, color .15s;
      flex-shrink: 0; font-size: .85rem;
    }
    .ov-close:hover { background: rgba(19,133,182,.09); color: var(--brand-ink); }

    /* ══ Panel form ═════════════════════════════════════════ */
    .panel-form { display: flex; flex-direction: column; padding: 0 1.6rem 1.4rem; }

    .form-section {
      padding: 1.1rem 0;
      border-bottom: 1px solid rgba(19,133,182,.07);
      display: flex; flex-direction: column; gap: .8rem;
    }

    .section-label {
      display: flex; align-items: center; gap: .4rem;
      font-size: .72rem; font-weight: 700; letter-spacing: .07em;
      text-transform: uppercase; color: #94a3b8;
    }
    .section-optional {
      margin-left: .3rem; font-weight: 400; text-transform: none;
      letter-spacing: 0; font-size: .72rem;
      background: #f1f5f9; color: #94a3b8; border-radius: 4px; padding: 0 5px;
    }

    /* Destino */
    .dest-chip {
      display: inline-flex; align-items: center; gap: .45rem;
      background: rgba(19,133,182,.08); color: var(--brand-blue);
      border: 1.5px solid rgba(19,133,182,.2); border-radius: 8px;
      padding: .5rem 1rem; font-size: .88rem; font-weight: 600; align-self: flex-start;
    }
    .dest-create { display: flex; flex-direction: column; gap: .5rem; }
    .dest-select {
      width: 100%; padding: .62rem .85rem; border-radius: 8px;
      border: 1.5px solid #d1dde8; font-size: .9rem; font-family: inherit;
      background: #f8fafd; color: var(--brand-ink);
      transition: border-color .15s, box-shadow .15s; appearance: auto;
    }
    .dest-select:focus {
      outline: none; border-color: var(--brand-blue);
      background: #fff; box-shadow: 0 0 0 3px rgba(19,133,182,.12);
    }

    /* Fields */
    .field { display: flex; flex-direction: column; gap: .35rem; }
    .field-sm { flex: 0 0 120px; }
    .field-grow { flex: 1; }
    .field-label { font-size: .8rem; font-weight: 600; color: #475569; }
    .field-optional { font-weight: 400; font-size: .78rem; color: #94a3b8; }

    .input-wrap { position: relative; }
    .char-count {
      position: absolute; right: .7rem; top: 50%; transform: translateY(-50%);
      font-size: .7rem; color: #94a3b8; pointer-events: none;
      font-variant-numeric: tabular-nums;
    }
    .char-count.char-warn { color: #d97706; }

    .field-input {
      width: 100%; padding: .62rem .85rem; border-radius: 8px;
      border: 1.5px solid #d1dde8; font-size: .9rem; font-family: inherit;
      background: #f8fafd; color: var(--brand-ink); box-sizing: border-box;
      transition: border-color .15s, box-shadow .15s;
    }
    .input-wrap .field-input { padding-right: 3.8rem; }
    .field-input:focus {
      outline: none; border-color: var(--brand-blue);
      background: #fff; box-shadow: 0 0 0 3px rgba(19,133,182,.12);
    }
    .field-textarea {
      width: 100%; padding: .62rem .85rem; border-radius: 8px;
      border: 1.5px solid #d1dde8; font-size: .9rem; font-family: inherit;
      background: #f8fafd; color: var(--brand-ink); box-sizing: border-box;
      resize: vertical; min-height: 80px; line-height: 1.55;
      transition: border-color .15s, box-shadow .15s;
    }
    .field-textarea:focus {
      outline: none; border-color: var(--brand-blue);
      background: #fff; box-shadow: 0 0 0 3px rgba(19,133,182,.12);
    }

    /* Configuración */
    .config-row { display: flex; gap: 1rem; align-items: flex-start; }
    .quorum-input-wrap { position: relative; }
    .quorum-input { padding-right: 2rem !important; text-align: right; }
    .quorum-pct {
      position: absolute; right: .75rem; top: 50%; transform: translateY(-50%);
      font-size: .82rem; color: #94a3b8; pointer-events: none;
    }
    .weight-toggle {
      display: flex; border-radius: 9px; overflow: hidden;
      border: 1.5px solid #d1dde8;
    }
    .weight-btn {
      flex: 1; padding: .62rem .7rem; border: none; cursor: pointer;
      background: #f8fafd; color: #64748b;
      font-size: .82rem; font-family: inherit; font-weight: 600;
      display: flex; align-items: center; justify-content: center; gap: .35rem;
      transition: background .15s, color .15s;
    }
    .weight-btn + .weight-btn { border-left: 1.5px solid #d1dde8; }
    .weight-btn.active { background: #1385B6; color: #fff; }
    .config-hint {
      font-size: .78rem; color: #64748b;
      display: flex; align-items: center; gap: .4rem; margin: -.2rem 0 0;
    }

    /* Opciones */
    .options-list { display: flex; flex-direction: column; gap: .55rem; }
    .option-row { display: flex; align-items: center; gap: .6rem; }
    .option-badge {
      width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
      background: rgba(19,133,182,.1); color: var(--brand-blue);
      font-size: .72rem; font-weight: 800;
      display: grid; place-items: center;
    }
    .option-input { flex: 1; }
    .option-remove {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      background: none; border: 1.5px solid #e2e8f0; cursor: pointer;
      color: #94a3b8; font-size: .72rem;
      display: grid; place-items: center;
      transition: border-color .15s, color .15s, background .15s;
    }
    .option-remove:hover:not(:disabled) { border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,.06); }
    .option-remove:disabled { opacity: .3; cursor: not-allowed; }

    .add-option-btn {
      align-self: flex-start; background: none;
      border: 1.5px dashed rgba(19,133,182,.3); border-radius: 8px;
      padding: .5rem 1rem; cursor: pointer;
      color: var(--brand-blue); font-size: .82rem; font-weight: 600; font-family: inherit;
      display: inline-flex; align-items: center; gap: .35rem;
      transition: border-color .15s, background .15s;
    }
    .add-option-btn:hover:not(:disabled) { background: rgba(19,133,182,.05); border-color: var(--brand-blue); }
    .add-option-btn:disabled { opacity: .35; cursor: not-allowed; }

    /* Footer form */
    .panel-footer {
      display: flex; justify-content: space-between; align-items: center;
      gap: .75rem; padding-top: 1.2rem;
    }

    /* ══ Panel resultados ════════════════════════════════════ */
    .results-loading {
      padding: 2rem; text-align: center;
      color: var(--brand-muted); display: flex; align-items: center;
      justify-content: center; gap: .6rem; font-size: .9rem;
    }

    .results-body { padding: 1.4rem 1.6rem; display: flex; flex-direction: column; gap: 1.2rem; }

    .status-bar { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
    .status-actions { display: flex; gap: .6rem; margin-left: auto; flex-wrap: wrap; }

    /* Quórum summary */
    .quorum-summary {
      display: flex; align-items: stretch;
      background: #f8fafd; border: 1px solid rgba(19,133,182,.1);
      border-radius: 12px; overflow: hidden;
    }
    .qs-stat {
      flex: 1; padding: .9rem 1rem; text-align: center;
      display: flex; flex-direction: column; gap: .2rem;
    }
    .qs-num {
      font-size: 1.25rem; font-weight: 800; color: var(--brand-ink);
      font-variant-numeric: tabular-nums;
      display: flex; align-items: center; justify-content: center; gap: .3rem;
    }
    .qs-lbl { font-size: .72rem; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; }
    .qs-div { width: 1px; background: rgba(19,133,182,.1); flex-shrink: 0; }

    /* Resultados opciones */
    .results-section { display: flex; flex-direction: column; gap: .75rem; }
    .results-title {
      font-size: .72rem; font-weight: 700; letter-spacing: .07em;
      text-transform: uppercase; color: #94a3b8;
      display: flex; align-items: center; gap: .4rem; margin-bottom: .1rem;
    }
    .units-hint { font-weight: 400; text-transform: none; letter-spacing: 0; font-size: .72rem; color: #94a3b8; }
    .empty-hint { font-size: .85rem; color: #94a3b8; font-style: italic; }

    .option-result { display: flex; flex-direction: column; gap: .4rem; }
    .opt-header { display: flex; justify-content: space-between; align-items: baseline; }
    .opt-label { font-weight: 700; font-size: .9rem; color: var(--brand-ink); }
    .opt-stats { font-size: .78rem; color: #64748b; font-variant-numeric: tabular-nums; }
    .opt-bar-track { height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
    .opt-bar-fill {
      height: 100%; background: var(--brand-blue); border-radius: 5px;
      transition: width .5s ease; min-width: 2px;
    }
    .bar-winner { background: #059669; }

    /* Unidades */
    .units-section { display: flex; flex-direction: column; gap: .6rem; }
    .units-list { display: flex; flex-direction: column; gap: .4rem; max-height: 300px; overflow-y: auto; }
    .unit-row {
      display: flex; align-items: center; justify-content: space-between; gap: .75rem;
      padding: .6rem .9rem; border-radius: 9px;
      border: 1px solid #e2e8f0; background: #fff;
      transition: border-color .15s;
    }
    .unit-voted { border-color: rgba(5,150,105,.25); background: rgba(5,150,105,.03); }
    .unit-info { display: flex; align-items: center; gap: .5rem; flex: 1; min-width: 0; }
    .unit-code { font-weight: 800; font-size: .88rem; color: var(--brand-ink); }
    .unit-coeff { font-size: .72rem; color: #94a3b8; }
    .unit-badge {
      font-size: .72rem; font-weight: 600; border-radius: 5px; padding: 1px 7px;
      display: inline-flex; align-items: center; gap: 3px;
    }
    .unit-badge.voted { background: rgba(5,150,105,.1); color: #047857; }
    .unit-badge.pending { background: #f1f5f9; color: #94a3b8; font-style: italic; font-weight: 400; }

    .unit-cast-actions { display: flex; gap: .35rem; flex-wrap: wrap; flex-shrink: 0; }
    .cast-btn {
      padding: 3px 9px; border-radius: 6px;
      border: 1.5px solid #d1dde8; background: #f8fafd;
      color: var(--brand-ink); font-size: .76rem; font-weight: 600; font-family: inherit;
      cursor: pointer; white-space: nowrap;
      transition: border-color .12s, background .12s, color .12s;
    }
    .cast-btn:hover:not(:disabled) { border-color: var(--brand-blue); color: var(--brand-blue); background: rgba(19,133,182,.05); }
    .cast-btn.cast-active { background: var(--brand-blue); color: #fff; border-color: var(--brand-blue); }
    .cast-btn:disabled { opacity: .5; cursor: wait; }
    .cast-remove-btn {
      width: 26px; height: 26px; border-radius: 50%;
      background: none; border: 1.5px solid #fca5a5;
      color: #ef4444; cursor: pointer; font-size: .72rem;
      display: grid; place-items: center;
      transition: background .12s;
    }
    .cast-remove-btn:hover:not(:disabled) { background: rgba(239,68,68,.08); }
    .cast-remove-btn:disabled { opacity: .4; cursor: wait; }
  `]
})
export class VotacionesPageComponent implements OnInit {
  private readonly votesApi = inject(VotesApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly msg = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  buildings: Building[] = [];
  buildingOptions: { label: string; value: string }[] = [];
  selectedBuildingId: string | null = null;

  items: Vote[] = [];
  filteredItems: Vote[] = [];
  loading = true;
  pageError = '';

  panelVisible = false;
  panelMode: PanelMode = 'form';
  selectedVote: Vote | null = null;
  detail: Vote | null = null;

  form: { buildingId: string; title: string; description: string; quorumPercentage: number; weightType: VoteWeightType } = {
    buildingId: '', title: '', description: '', quorumPercentage: 50, weightType: 'ByUnit'
  };
  optionLabels: string[] = ['A favor', 'En contra'];

  saving = false;
  formError = '';
  panelError = '';
  transitioning = false;
  castingUnitId: string | null = null;

  ngOnInit() {
    forkJoin({
      buildings: this.buildingsApi.getAll(),
      votes: this.votesApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ buildings, votes }) => {
        this.buildings = buildings.filter(b => b.isActive).sort((a, b) => a.name.localeCompare(b.name));
        this.buildingOptions = this.buildings.map(b => ({ label: b.name, value: b.id }));
        this.items = votes;
        this.applyFilter();
        this.loading = false;
        if (this.buildings.length === 1) this.form.buildingId = this.buildings[0].id;
        this.cdr.markForCheck();
      },
      error: err => {
        this.pageError = extractApiErrorMessage(err, 'No se pudo cargar las votaciones.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onBuildingFilter() { this.applyFilter(); }

  private applyFilter() {
    this.filteredItems = this.selectedBuildingId
      ? this.items.filter(v => v.buildingId === this.selectedBuildingId)
      : this.items;
  }

  openCreate() {
    this.selectedVote = null;
    this.panelMode = 'form';
    this.form = {
      buildingId: this.buildings.length === 1 ? this.buildings[0].id : '',
      title: '', description: '', quorumPercentage: 50, weightType: 'ByUnit'
    };
    this.optionLabels = ['A favor', 'En contra'];
    this.formError = '';
    this.panelVisible = true;
  }

  openResults(vote: Vote) {
    this.panelError = '';
    this.detail = null;
    this.panelMode = 'results';
    this.panelVisible = true;
    this.votesApi.getById(vote.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: v => { this.detail = v; this.cdr.markForCheck(); },
      error: err => { this.panelError = extractApiErrorMessage(err, 'No se pudo cargar la votación.'); this.cdr.markForCheck(); }
    });
  }

  switchToEdit() {
    if (!this.detail) return;
    this.selectedVote = this.detail;
    this.form = {
      buildingId: this.detail.buildingId,
      title: this.detail.title,
      description: this.detail.description ?? '',
      quorumPercentage: this.detail.quorumPercentage,
      weightType: this.detail.weightType
    };
    this.optionLabels = this.detail.options.length >= 2
      ? this.detail.options.map(o => o.label)
      : ['A favor', 'En contra'];
    this.formError = '';
    this.panelMode = 'form';
    this.cdr.markForCheck();
  }

  closePanel() { this.panelVisible = false; this.selectedVote = null; this.detail = null; }

  save() {
    if (!this.form.buildingId) { this.formError = 'Selecciona un edificio.'; return; }
    if (!this.form.title.trim()) { this.formError = 'El título es obligatorio.'; return; }
    const labels = this.optionLabels.map(l => l.trim()).filter(l => l.length > 0);
    if (labels.length < 2) { this.formError = 'Se necesitan al menos 2 opciones.'; return; }

    const req: VoteUpsertRequest = {
      buildingId: this.form.buildingId,
      title: this.form.title.trim(),
      description: this.form.description.trim() || null,
      quorumPercentage: this.form.quorumPercentage,
      weightType: this.form.weightType,
      optionLabels: labels
    };

    this.saving = true; this.formError = '';
    const op = this.selectedVote ? this.votesApi.update(this.selectedVote.id, req) : this.votesApi.create(req);

    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: vote => {
        this.saving = false;
        this.msg.add({ severity: 'success', summary: this.selectedVote ? 'Votación actualizada' : 'Votación creada', life: 3000 });
        this.upsertLocal(vote);
        this.closePanel();
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.formError = extractApiErrorMessage(err, 'No se pudo guardar.');
        this.cdr.markForCheck();
      }
    });
  }

  deleteVote() {
    if (!this.selectedVote) return;
    this.saving = true;
    this.votesApi.delete(this.selectedVote.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving = false;
        this.msg.add({ severity: 'success', summary: 'Votación eliminada', life: 3000 });
        this.items = this.items.filter(v => v.id !== this.selectedVote!.id);
        this.applyFilter();
        this.closePanel();
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.formError = extractApiErrorMessage(err, 'No se pudo eliminar.');
        this.cdr.markForCheck();
      }
    });
  }

  openVote() {
    if (!this.detail) return;
    this.transitioning = true; this.panelError = '';
    this.votesApi.open(this.detail.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: v => { this.transitioning = false; this.detail = v; this.upsertLocal(v); this.cdr.markForCheck(); },
      error: err => { this.transitioning = false; this.panelError = extractApiErrorMessage(err, 'No se pudo abrir.'); this.cdr.markForCheck(); }
    });
  }

  closeVote() {
    if (!this.detail) return;
    this.transitioning = true; this.panelError = '';
    this.votesApi.close(this.detail.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: v => { this.transitioning = false; this.detail = v; this.upsertLocal(v); this.cdr.markForCheck(); },
      error: err => { this.transitioning = false; this.panelError = extractApiErrorMessage(err, 'No se pudo cerrar.'); this.cdr.markForCheck(); }
    });
  }

  castVote(unit: VoteUnitSummary, opt: VoteOptionDto) {
    if (!this.detail || this.castingUnitId) return;
    this.castingUnitId = unit.unitId;
    const req: VoteCastRequest = { unitId: unit.unitId, voteOptionId: opt.id };
    this.votesApi.cast(this.detail.id, req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: v => { this.castingUnitId = null; this.detail = v; this.upsertLocal(v); this.cdr.markForCheck(); },
      error: err => { this.castingUnitId = null; this.panelError = extractApiErrorMessage(err, 'No se pudo registrar el voto.'); this.cdr.markForCheck(); }
    });
  }

  removeCast(unit: VoteUnitSummary) {
    if (!this.detail || !unit.castId || this.castingUnitId) return;
    this.castingUnitId = unit.unitId;
    this.votesApi.removeCast(this.detail.id, unit.castId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: v => { this.castingUnitId = null; this.detail = v; this.upsertLocal(v); this.cdr.markForCheck(); },
      error: err => { this.castingUnitId = null; this.panelError = extractApiErrorMessage(err, 'No se pudo quitar el voto.'); this.cdr.markForCheck(); }
    });
  }

  isWinner(opt: VoteOptionDto): boolean {
    if (!this.detail || this.detail.options.length === 0) return false;
    const max = Math.max(...this.detail.options.map(o => o.percentage));
    return opt.percentage === max && max > 0;
  }

  private upsertLocal(vote: Vote) {
    const idx = this.items.findIndex(v => v.id === vote.id);
    if (idx >= 0) this.items[idx] = vote; else this.items.unshift(vote);
    this.applyFilter();
  }

  statusLabel(status: string): string { return STATUS_LABEL[status as VoteStatus] ?? status; }
  statusSeverity(status: string): TagSeverity { return STATUS_SEVERITY[status as VoteStatus] ?? 'secondary'; }
  weightLabel(wt?: string | null): string { return wt === 'ByCoefficient' ? 'Por coeficiente' : 'Por unidad'; }
  formatDate(d: string): string { return new Date(d).toLocaleDateString('es-PY'); }
  trackByIdx(i: number): number { return i; }
  addOption() { if (this.optionLabels.length < 10) this.optionLabels.push(''); }
  removeOption(i: number) { if (this.optionLabels.length > 2) this.optionLabels.splice(i, 1); }
}
