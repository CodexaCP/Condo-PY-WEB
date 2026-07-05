import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { Select } from 'primeng/select';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { AnnouncementsApiService } from '../../api/announcements-api.service';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { Announcement, AnnouncementCategory, AnnouncementUpsertRequest, Building } from '../../api/models';

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';
type CategoryOption = { label: string; value: AnnouncementCategory; icon: string };

const CATEGORIES: CategoryOption[] = [
  { label: 'General',       value: 'General',       icon: 'pi-bell' },
  { label: 'Mantenimiento', value: 'Mantenimiento',  icon: 'pi-wrench' },
  { label: 'Seguridad',     value: 'Seguridad',      icon: 'pi-shield' },
  { label: 'Financiero',    value: 'Financiero',     icon: 'pi-dollar' },
  { label: 'Convocatoria',  value: 'Convocatoria',   icon: 'pi-users' },
  { label: 'Otro',          value: 'Otro',           icon: 'pi-ellipsis-h' }
];

const CATEGORY_SEVERITY: Record<AnnouncementCategory, TagSeverity> = {
  General:      'info',
  Mantenimiento:'warn',
  Seguridad:    'danger',
  Financiero:   'secondary',
  Convocatoria: 'contrast',
  Otro:         'secondary'
};

@Component({
  standalone: true,
  selector: 'app-comunicados-page',
  imports: [CommonModule, FormsModule, Button, Card, Message, Tag, Select],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Comunicados</h1>
            <p>Avisos y notificaciones para residentes y propietarios del edificio.</p>
          </div>
        </div>
        <div class="toolbar-actions">
          <p-button *ngIf="buildings.length > 1" label="Publicar en todos" icon="pi pi-send"
                    severity="secondary" [outlined]="true" (onClick)="openBroadcast()"></p-button>
          <p-button label="Nuevo comunicado" icon="pi pi-plus" (onClick)="openCreate()"></p-button>
        </div>
      </div>

      <!-- Filtro de edificio -->
      <div class="filter-bar" *ngIf="buildings.length > 1">
        <label class="filter-label">Edificio:</label>
        <p-select [options]="buildingOptions" [(ngModel)]="selectedBuildingId" optionLabel="label"
                  optionValue="value" placeholder="Todos los edificios"
                  [showClear]="true" (onChange)="onBuildingFilter()"
                  styleClass="filter-select">
        </p-select>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando comunicados...</p>
      <p class="app-state" *ngIf="!loading && !pageError && !filteredItems.length">No hay comunicados para mostrar.</p>

      <div class="app-list" *ngIf="filteredItems.length">
        <div class="app-row header comm-grid" [class.with-building]="buildings.length > 1">
          <span>Título</span>
          <span>Categoría</span>
          <span *ngIf="buildings.length > 1">Edificio</span>
          <span>Publicado</span>
          <span>Vence</span>
          <span>Estado</span>
        </div>
        <div class="app-row comm-grid" [class.with-building]="buildings.length > 1" *ngFor="let item of filteredItems">
          <button class="row-link" (click)="openEdit(item)">{{ item.title }}</button>
          <p-tag [value]="item.category" [severity]="categorySeverity(item.category)"></p-tag>
          <span *ngIf="buildings.length > 1" class="building-label">{{ item.buildingName }}</span>
          <span>{{ item.publishedAt ? formatDate(item.publishedAt) : '—' }}</span>
          <span [class.expired]="isExpired(item.expiresAt)">
            {{ item.expiresAt ? formatDate(item.expiresAt) : '—' }}
          </span>
          <p-tag [value]="item.isActive ? 'Activo' : 'Inactivo'"
                 [severity]="item.isActive ? 'success' : 'secondary'"></p-tag>
        </div>
      </div>
    </p-card>

    <!-- BACKDROP -->
    <div class="ov-backdrop" *ngIf="dialogVisible" (click)="closeDialog()"></div>

    <!-- PANEL CREAR / EDITAR -->
    <div class="ov-panel" *ngIf="dialogVisible" (click)="$event.stopPropagation()">

      <!-- Header con acento por modo -->
      <div class="panel-header" [class.mode-broadcast]="isBroadcast" [class.mode-edit]="!!selected">
        <div class="panel-header-icon">
          <span class="pi"
            [class.pi-plus-circle]="!selected && !isBroadcast"
            [class.pi-send]="isBroadcast"
            [class.pi-pencil]="!!selected"></span>
        </div>
        <div class="panel-header-text">
          <h2>{{ selected ? 'Editar comunicado' : (isBroadcast ? 'Difusión masiva' : 'Nuevo comunicado') }}</h2>
          <p>{{ selected ? 'Modifica el contenido del aviso' : (isBroadcast ? 'Se enviará a todos tus edificios' : 'Crea un nuevo aviso para el edificio') }}</p>
        </div>
        <button class="ov-close" type="button" (click)="closeDialog()">
          <span class="pi pi-times"></span>
        </button>
      </div>

      <form class="panel-form" (ngSubmit)="save()">

        <!-- SECCIÓN: DESTINO -->
        <div class="form-section">
          <div class="section-label"><span class="pi pi-home"></span> Destino</div>

          <!-- Edición: chip del edificio -->
          <div *ngIf="selected" class="dest-chip">
            <span class="pi pi-building"></span> {{ selected.buildingName }}
          </div>

          <!-- Difusión: badge verde -->
          <div *ngIf="isBroadcast" class="dest-broadcast">
            <span class="pi pi-send dest-broadcast-icon"></span>
            <div>
              <strong>Todos los edificios</strong>
              <span>{{ buildings.length }} edificio(s) recibirán este comunicado</span>
            </div>
          </div>

          <!-- Crear: selector + atajo difusión -->
          <div *ngIf="!isBroadcast && !selected" class="dest-create">
            <select class="dest-select" [(ngModel)]="form.buildingId" name="buildingId" required>
              <option value="" disabled>Selecciona un edificio</option>
              <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
            </select>
            <button *ngIf="buildings.length > 1" type="button" class="broadcast-link" (click)="switchToBroadcast()">
              <span class="pi pi-send"></span> Publicar en todos los edificios
            </button>
          </div>
        </div>

        <!-- SECCIÓN: CONTENIDO -->
        <div class="form-section">
          <div class="section-label"><span class="pi pi-align-left"></span> Contenido</div>

          <div class="field">
            <label class="field-label">Título</label>
            <div class="input-wrap">
              <input class="field-input" [(ngModel)]="form.title" name="title"
                     required maxlength="200" placeholder="Ej: Corte de agua programado" />
              <span class="char-count" [class.char-warn]="form.title.length > 170">
                {{ form.title.length }}/200
              </span>
            </div>
          </div>

          <div class="field">
            <label class="field-label">Contenido</label>
            <textarea class="field-textarea" [(ngModel)]="form.body" name="body"
                      required rows="5" placeholder="Escribe aquí el detalle del comunicado..."></textarea>
          </div>
        </div>

        <!-- SECCIÓN: CATEGORÍA -->
        <div class="form-section">
          <div class="section-label"><span class="pi pi-tag"></span> Categoría</div>
          <div class="cat-grid">
            <button *ngFor="let cat of categories" type="button"
                    class="cat-chip"
                    [class.cat-general]="cat.value === 'General'"
                    [class.cat-mantenimiento]="cat.value === 'Mantenimiento'"
                    [class.cat-seguridad]="cat.value === 'Seguridad'"
                    [class.cat-financiero]="cat.value === 'Financiero'"
                    [class.cat-convocatoria]="cat.value === 'Convocatoria'"
                    [class.cat-otro]="cat.value === 'Otro'"
                    [class.selected]="form.category === cat.value"
                    (click)="form.category = cat.value">
              <span class="pi" [class]="cat.icon"></span>
              {{ cat.label }}
            </button>
          </div>
        </div>

        <!-- SECCIÓN: PROGRAMACIÓN -->
        <div class="form-section">
          <div class="section-label">
            <span class="pi pi-calendar"></span> Programación
            <span class="section-optional">opcional</span>
          </div>
          <div class="date-row">
            <div class="field">
              <label class="field-label">Fecha de publicación</label>
              <input class="field-input" type="datetime-local"
                     [(ngModel)]="form.publishedAt" name="publishedAt" />
            </div>
            <div class="field">
              <label class="field-label">Fecha de vencimiento</label>
              <input class="field-input" type="datetime-local"
                     [(ngModel)]="form.expiresAt" name="expiresAt" />
            </div>
          </div>
        </div>

        <!-- TOGGLE ACTIVO -->
        <div class="toggle-row">
          <div class="toggle-info">
            <span class="toggle-title">Comunicado activo</span>
            <span class="toggle-sub">Visible para residentes y propietarios</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
            <span class="toggle-track"></span>
          </label>
        </div>

        <!-- FOOTER -->
        <div class="panel-footer">
          <p-button *ngIf="selected" type="button" label="Eliminar" severity="danger"
                    [outlined]="true" (onClick)="askDelete()"></p-button>
          <div *ngIf="!selected"></div>
          <p-button type="submit" [loading]="isSaving"
                    [label]="selected ? 'Guardar cambios' : (isBroadcast ? 'Publicar en todos' : 'Crear comunicado')"
                    [icon]="isBroadcast ? 'pi pi-send' : (selected ? 'pi pi-check' : 'pi pi-plus')">
          </p-button>
        </div>
      </form>
    </div>

    <!-- BACKDROP CONFIRM -->
    <div class="ov-backdrop ov-backdrop-top" *ngIf="confirmVisible" (click)="cancelDelete()"></div>

    <!-- CONFIRM -->
    <div class="ov-panel ov-panel-sm" *ngIf="confirmVisible" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Confirmar eliminación</strong>
        <button class="ov-close" type="button" (click)="cancelDelete()">✕</button>
      </div>
      <p class="confirm-text">
        ¿Eliminar el comunicado <strong>{{ selected?.title }}</strong>?
        Esta acción no se puede deshacer.
      </p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="cancelDelete()"></p-button>
        <p-button label="Eliminar" severity="danger" [loading]="isDeleting" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    /* ── Lista ────────────────────────────────────────────── */
    .toolbar-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

    .filter-bar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .filter-label { font-weight: 600; font-size: 0.9rem; color: var(--brand-ink); white-space: nowrap; }
    .filter-select { min-width: 220px; }

    .comm-grid { grid-template-columns: 2fr 1fr 1fr 1fr 0.8fr; }
    .comm-grid.with-building { grid-template-columns: 2fr 1fr 1.2fr 1fr 1fr 0.8fr; }

    .row-link { background: none; border: none; padding: 0; font: inherit; font-weight: 700;
                color: var(--brand-blue); cursor: pointer; text-align: left;
                text-decoration: underline dotted; overflow: hidden;
                text-overflow: ellipsis; white-space: nowrap; }
    .row-link:hover { color: var(--brand-ink); }
    .building-label { color: var(--brand-blue); font-weight: 600; font-size: 0.88rem; }
    .expired { color: #dc2626; font-weight: 600; }

    /* ── Overlay ─────────────────────────────────────────── */
    .ov-backdrop {
      position: fixed; inset: 0; background: rgba(10,25,45,0.5);
      z-index: 1000; backdrop-filter: blur(3px); animation: fadeIn 0.15s ease;
    }
    .ov-backdrop-top { z-index: 1002; }

    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(600px, calc(100vw - 2rem)); max-height: 90vh; overflow-y: auto;
      background: #fff; border-radius: 20px; z-index: 1001;
      box-shadow: 0 40px 100px rgba(10,30,60,0.3), 0 0 0 1px rgba(19,133,182,0.08);
      animation: slideUp 0.22s cubic-bezier(.4,0,.2,1);
      display: flex; flex-direction: column;
    }
    .ov-panel-sm { width: min(420px, calc(100vw - 2rem)); z-index: 1003; padding: 1.6rem; }

    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translate(-50%, calc(-50% + 20px)); }
                         to   { opacity: 1; transform: translate(-50%, -50%); } }

    /* ── Panel header ─────────────────────────────────────── */
    .panel-header {
      display: flex; align-items: flex-start; gap: 1rem;
      padding: 1.4rem 1.6rem 1.2rem;
      background: linear-gradient(135deg, rgba(19,133,182,0.06) 0%, transparent 70%);
      border-bottom: 1px solid rgba(19,133,182,0.1);
      flex-shrink: 0;
    }
    .panel-header.mode-broadcast {
      background: linear-gradient(135deg, rgba(5,150,105,0.07) 0%, transparent 70%);
      border-bottom-color: rgba(5,150,105,0.12);
    }
    .panel-header.mode-edit {
      background: linear-gradient(135deg, rgba(217,119,6,0.07) 0%, transparent 70%);
      border-bottom-color: rgba(217,119,6,0.12);
    }

    .panel-header-icon {
      width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
      background: rgba(19,133,182,0.12); color: var(--brand-blue);
      display: grid; place-items: center; font-size: 1.1rem;
    }
    .mode-broadcast .panel-header-icon { background: rgba(5,150,105,0.12); color: #059669; }
    .mode-edit .panel-header-icon      { background: rgba(217,119,6,0.12); color: #B45309; }

    .panel-header-text { flex: 1; min-width: 0; }
    .panel-header-text h2 { margin: 0 0 0.2rem; font-size: 1.05rem; font-weight: 700; color: var(--brand-ink); }
    .panel-header-text p  { margin: 0; font-size: 0.8rem; color: var(--brand-muted); }

    .ov-close {
      background: none; border: none; cursor: pointer;
      color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center; transition: background 0.15s, color 0.15s;
      flex-shrink: 0; font-size: 0.85rem;
    }
    .ov-close:hover { background: rgba(19,133,182,0.09); color: var(--brand-ink); }

    /* ── Panel form ──────────────────────────────────────── */
    .panel-form { display: flex; flex-direction: column; padding: 0 1.6rem 1.4rem; }

    .form-section {
      padding: 1.1rem 0;
      border-bottom: 1px solid rgba(19,133,182,0.07);
      display: flex; flex-direction: column; gap: 0.8rem;
    }

    .section-label {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.72rem; font-weight: 700; letter-spacing: 0.07em;
      text-transform: uppercase; color: #94a3b8;
    }
    .section-optional {
      margin-left: 0.3rem; font-weight: 400; text-transform: none;
      letter-spacing: 0; font-size: 0.72rem;
      background: #f1f5f9; color: #94a3b8; border-radius: 4px; padding: 0 5px;
    }

    /* ── Destino ─────────────────────────────────────────── */
    .dest-chip {
      display: inline-flex; align-items: center; gap: 0.45rem;
      background: rgba(19,133,182,0.08); color: var(--brand-blue);
      border: 1.5px solid rgba(19,133,182,0.2); border-radius: 8px;
      padding: 0.5rem 1rem; font-size: 0.88rem; font-weight: 600;
      align-self: flex-start;
    }

    .dest-broadcast {
      display: flex; align-items: center; gap: 0.85rem;
      background: rgba(5,150,105,0.06); border: 1.5px solid rgba(5,150,105,0.2);
      border-radius: 10px; padding: 0.8rem 1rem; color: #047857;
    }
    .dest-broadcast-icon { font-size: 1.25rem; flex-shrink: 0; }
    .dest-broadcast strong { display: block; font-weight: 700; font-size: 0.9rem; margin-bottom: 0.1rem; }
    .dest-broadcast span  { font-size: 0.78rem; opacity: 0.85; }

    .dest-create { display: flex; flex-direction: column; gap: 0.5rem; }
    .dest-select {
      width: 100%; padding: 0.62rem 0.85rem; border-radius: 8px;
      border: 1.5px solid #d1dde8; font-size: 0.9rem; font-family: inherit;
      background: #f8fafd; color: var(--brand-ink);
      transition: border-color 0.15s, box-shadow 0.15s;
      appearance: auto;
    }
    .dest-select:focus {
      outline: none; border-color: var(--brand-blue);
      background: #fff; box-shadow: 0 0 0 3px rgba(19,133,182,0.12);
    }

    .broadcast-link {
      align-self: flex-start; background: none; border: none; cursor: pointer; padding: 0;
      color: var(--brand-blue); font-size: 0.8rem; font-weight: 600;
      display: inline-flex; align-items: center; gap: 0.3rem;
      text-decoration: underline dotted; text-underline-offset: 2px;
    }
    .broadcast-link:hover { color: var(--brand-ink); }

    /* ── Fields ──────────────────────────────────────────── */
    .field { display: flex; flex-direction: column; gap: 0.35rem; }
    .field-label { font-size: 0.8rem; font-weight: 600; color: #475569; }

    .input-wrap { position: relative; }
    .char-count {
      position: absolute; right: 0.7rem; top: 50%; transform: translateY(-50%);
      font-size: 0.7rem; color: #94a3b8; pointer-events: none;
      font-variant-numeric: tabular-nums;
    }
    .char-count.char-warn { color: #d97706; }

    .field-input {
      width: 100%; padding: 0.62rem 0.85rem; border-radius: 8px;
      border: 1.5px solid #d1dde8; font-size: 0.9rem; font-family: inherit;
      background: #f8fafd; color: var(--brand-ink); box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-wrap .field-input { padding-right: 3.8rem; }
    .field-input:focus {
      outline: none; border-color: var(--brand-blue);
      background: #fff; box-shadow: 0 0 0 3px rgba(19,133,182,0.12);
    }

    .field-textarea {
      width: 100%; padding: 0.62rem 0.85rem; border-radius: 8px;
      border: 1.5px solid #d1dde8; font-size: 0.9rem; font-family: inherit;
      background: #f8fafd; color: var(--brand-ink); box-sizing: border-box;
      resize: vertical; min-height: 110px; line-height: 1.55;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field-textarea:focus {
      outline: none; border-color: var(--brand-blue);
      background: #fff; box-shadow: 0 0 0 3px rgba(19,133,182,0.12);
    }

    /* ── Categoría chips ─────────────────────────────────── */
    .cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }

    .cat-chip {
      display: flex; align-items: center; justify-content: center; gap: 0.4rem;
      padding: 0.55rem 0.4rem; border-radius: 9px; cursor: pointer; border: 1.5px solid #e2e8f0;
      font-size: 0.8rem; font-weight: 600; background: #f8fafd; color: #64748b;
      transition: all 0.15s; line-height: 1;
    }
    .cat-chip:hover { border-color: #cbd5e1; background: #f1f5f9; transform: translateY(-1px); }
    .cat-chip:active { transform: translateY(0); }

    /* Colores por categoría — solo activos */
    .cat-chip.cat-general.selected        { background: rgba(19,133,182,0.1);  border-color: #1385B6; color: #1385B6; }
    .cat-chip.cat-mantenimiento.selected  { background: rgba(217,119,6,0.09);  border-color: #D97706; color: #B45309; }
    .cat-chip.cat-seguridad.selected      { background: rgba(220,38,38,0.09);  border-color: #DC2626; color: #B91C1C; }
    .cat-chip.cat-financiero.selected     { background: rgba(5,150,105,0.09);  border-color: #059669; color: #047857; }
    .cat-chip.cat-convocatoria.selected   { background: rgba(124,58,237,0.09); border-color: #7C3AED; color: #6D28D9; }
    .cat-chip.cat-otro.selected           { background: rgba(100,116,139,0.1); border-color: #64748B; color: #475569; }

    /* icono del chip seleccionado hereda el color del texto */
    .cat-chip.selected .pi { color: inherit; }

    /* ── Fecha ───────────────────────────────────────────── */
    .date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    @media (max-width: 480px) { .date-row { grid-template-columns: 1fr; } }

    /* ── Toggle ──────────────────────────────────────────── */
    .toggle-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 0; border-bottom: 1px solid rgba(19,133,182,0.07);
    }
    .toggle-info { display: flex; flex-direction: column; gap: 0.2rem; }
    .toggle-title { font-size: 0.9rem; font-weight: 600; color: var(--brand-ink); }
    .toggle-sub   { font-size: 0.78rem; color: var(--brand-muted); }

    .toggle-switch { position: relative; flex-shrink: 0; cursor: pointer; display: block; }
    .toggle-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
    .toggle-track {
      display: block; width: 46px; height: 26px; border-radius: 13px;
      background: #cbd5e1; transition: background 0.2s;
    }
    .toggle-track::after {
      content: ''; position: absolute; top: 4px; left: 4px;
      width: 18px; height: 18px; border-radius: 50%; background: white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.18); transition: transform 0.2s;
    }
    .toggle-switch input:checked ~ .toggle-track { background: var(--brand-blue); }
    .toggle-switch input:checked ~ .toggle-track::after { transform: translateX(20px); }

    /* ── Footer ─────────────────────────────────────────── */
    .panel-footer {
      display: flex; justify-content: space-between; align-items: center;
      gap: 0.75rem; padding-top: 1.2rem;
    }

    /* ── Confirm modal ───────────────────────────────────── */
    .ov-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.2rem; padding-bottom: 1rem;
      border-bottom: 1px solid rgba(19,133,182,0.1);
    }
    .ov-header strong { font-size: 1.1rem; color: var(--brand-ink); }
    .confirm-text { margin: 0 0 1.2rem; color: var(--brand-ink); line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; }
  `]
})
export class ComunicadosPageComponent implements OnInit {
  private readonly api = inject(AnnouncementsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly msg = inject(MessageService);

  items: Announcement[] = [];
  buildings: Building[] = [];
  loading = true;
  pageError = '';
  dialogVisible = false;
  confirmVisible = false;
  isBroadcast = false;
  selected: Announcement | null = null;
  form = this.emptyForm();
  isSaving = false;
  isDeleting = false;
  selectedBuildingId: string | null = null;
  readonly categories = CATEGORIES;

  get buildingOptions() {
    return this.buildings.map(b => ({ label: b.name, value: b.id }));
  }

  get filteredItems(): Announcement[] {
    if (!this.selectedBuildingId) return this.items;
    return this.items.filter(x => x.buildingId === this.selectedBuildingId);
  }

  categorySeverity(cat: AnnouncementCategory): TagSeverity {
    return CATEGORY_SEVERITY[cat] ?? 'info';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  isExpired(expiresAt: string | null): boolean {
    return !!expiresAt && new Date(expiresAt) < new Date();
  }

  ngOnInit(): void {
    forkJoin({
      buildings: this.buildingsApi.getAll(),
      items: this.api.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ buildings, items }) => {
        this.buildings = buildings.filter(b => b.isActive).sort((a, b) => a.name.localeCompare(b.name));
        this.items = items;
        if (this.buildings.length === 1) this.form.buildingId = this.buildings[0].id;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.pageError = 'No se pudo cargar los comunicados.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onBuildingFilter(): void { this.cdr.markForCheck(); }

  openCreate(): void {
    this.selected = null; this.isBroadcast = false;
    this.form = this.emptyForm();
    if (this.buildings.length === 1) this.form.buildingId = this.buildings[0].id;
    if (this.selectedBuildingId) this.form.buildingId = this.selectedBuildingId;
    this.dialogVisible = true;
  }

  openBroadcast(): void {
    this.selected = null; this.isBroadcast = true;
    this.form = this.emptyForm();
    this.dialogVisible = true;
  }

  switchToBroadcast(): void { this.isBroadcast = true; this.form.buildingId = ''; }

  openEdit(item: Announcement): void {
    this.selected = item; this.isBroadcast = false;
    this.form = {
      buildingId: item.buildingId,
      title: item.title,
      body: item.body,
      category: item.category,
      publishedAt: item.publishedAt ? this.toDatetimeLocal(item.publishedAt) : '',
      expiresAt: item.expiresAt ? this.toDatetimeLocal(item.expiresAt) : '',
      isActive: item.isActive
    };
    this.dialogVisible = true;
  }

  closeDialog(): void {
    this.dialogVisible = false; this.confirmVisible = false;
    this.selected = null; this.isBroadcast = false;
  }

  save(): void {
    if (!this.isBroadcast && !this.form.buildingId) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El edificio es obligatorio.', life: 5000 }); return;
    }
    if (!this.form.title.trim()) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El título es obligatorio.', life: 5000 }); return;
    }
    if (!this.form.body.trim()) {
      this.msg.add({ severity: 'error', summary: 'Error', detail: 'El contenido es obligatorio.', life: 5000 }); return;
    }

    this.isSaving = true;

    if (this.isBroadcast) {
      this.api.broadcast({
        buildingIds: [],
        title: this.form.title.trim(), body: this.form.body.trim(), category: this.form.category,
        publishedAt: this.toUtcIso(this.form.publishedAt), expiresAt: this.toUtcIso(this.form.expiresAt),
        isActive: this.form.isActive
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: created => {
          this.items = [...created, ...this.items]; this.isSaving = false;
          this.msg.add({ severity: 'success', summary: 'Éxito', detail: `Publicado en ${created.length} edificio(s).`, life: 4000 });
          this.closeDialog(); this.cdr.markForCheck();
        },
        error: err => {
          this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo publicar.'), life: 5000 });
          this.isSaving = false; this.cdr.markForCheck();
        }
      });
      return;
    }

    const req: AnnouncementUpsertRequest = {
      buildingId: this.form.buildingId, title: this.form.title.trim(), body: this.form.body.trim(),
      category: this.form.category, publishedAt: this.toUtcIso(this.form.publishedAt),
      expiresAt: this.toUtcIso(this.form.expiresAt), isActive: this.form.isActive
    };

    const op = this.selected ? this.api.update(this.selected.id, req) : this.api.create(req);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: item => {
        this.items = this.selected ? this.items.map(x => x.id === item.id ? item : x) : [item, ...this.items];
        this.isSaving = false;
        this.msg.add({ severity: 'success', summary: 'Éxito', detail: this.selected ? 'Comunicado actualizado.' : 'Comunicado creado.', life: 4000 });
        this.selected = item; this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo guardar.'), life: 5000 });
        this.isSaving = false; this.cdr.markForCheck();
      }
    });
  }

  askDelete(): void { this.confirmVisible = true; }
  cancelDelete(): void { this.confirmVisible = false; }

  confirmDelete(): void {
    if (!this.selected) return;
    this.isDeleting = true;
    this.api.delete(this.selected.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter(x => x.id !== this.selected!.id);
        this.isDeleting = false; this.closeDialog(); this.cdr.markForCheck();
      },
      error: err => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo eliminar.'), life: 5000 });
        this.isDeleting = false; this.confirmVisible = false; this.cdr.markForCheck();
      }
    });
  }

  private toUtcIso(datetimeLocal: string): string | null {
    if (!datetimeLocal) return null;
    return new Date(datetimeLocal).toISOString();
  }

  private toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private emptyForm() {
    return { buildingId: '', title: '', body: '', category: 'General' as AnnouncementCategory,
             publishedAt: '', expiresAt: '', isActive: true };
  }
}
