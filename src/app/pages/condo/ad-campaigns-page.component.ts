import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { AdCampaignsApiService } from '../../api/ad-campaigns-api.service';
import { CompaniesApiService } from '../../api/companies-api.service';
import { resolveUploadUrl } from '../../api/file-url.util';
import { AdBuilding, AdCampaign, AdCampaignCategory, AdCampaignCreateRequest, Company } from '../../api/models';

const CATEGORIES: { value: AdCampaignCategory; label: string }[] = [
  { value: 'Gastronomia', label: 'Gastronomía' },
  { value: 'Supermercado', label: 'Supermercado' },
  { value: 'Farmacia', label: 'Farmacia' },
  { value: 'Lavanderia', label: 'Lavandería' },
  { value: 'ServiciosHogar', label: 'Servicios del hogar' },
  { value: 'BellezaBienestar', label: 'Belleza y bienestar' },
  { value: 'Educacion', label: 'Educación' },
  { value: 'Mascotas', label: 'Mascotas' },
  { value: 'Tecnologia', label: 'Tecnología' },
  { value: 'Inmobiliaria', label: 'Inmobiliaria' },
  { value: 'Otro', label: 'Otro' }
];

interface CampaignForm {
  companyId: string;
  advertiserName: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  category: AdCampaignCategory;
  position: number;
  startDate: string;
  endDate: string;
  monthlyAmount: number | null;
  isActive: boolean;
  notifyBeforeExpiry: boolean;
  buildingIds: string[];
}

// SuperAdmin: campañas de banners que se muestran en la app de los edificios con la Publicidad activada
// (el interruptor se maneja en «Publicidad por edificio»). Hasta 7 posiciones por edificio, una campaña por posición.
@Component({
  standalone: true,
  selector: 'app-ad-campaigns-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, Button, Card, Message, Tag],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Campañas de publicidad</h1>
            <p>Banners que ven propietarios y residentes en la app. Solo se pueden asignar a edificios con la publicidad activada.</p>
          </div>
        </div>
        <div class="toolbar-actions">
          <p-button label="Edificios" icon="pi pi-building" size="small" severity="secondary" [outlined]="true" routerLink="/ad-buildings"></p-button>
          <p-button label="Nueva campaña" icon="pi pi-plus" size="small" (onClick)="openNew()" [disabled]="loading || !!pageError"></p-button>
        </div>
      </div>

      <div class="filters">
        <input class="search" type="search" placeholder="Buscar anunciante o empresa" [ngModel]="search" (ngModelChange)="search = $event; cdr.markForCheck()" />
        <select [ngModel]="filter" (ngModelChange)="filter = $event; cdr.markForCheck()">
          <option value="all">Todas</option>
          <option value="live">Vigentes (activas y en fecha)</option>
          <option value="paused">Pausadas</option>
          <option value="expired">Vencidas</option>
        </select>
      </div>

      <p-message *ngIf="pageError" severity="error" [text]="pageError"></p-message>
      <p class="app-state" *ngIf="loading">Cargando campañas...</p>
      <p class="app-state" *ngIf="!loading && !visible.length && !pageError">No hay campañas para mostrar.</p>

      <div class="app-list" *ngIf="visible.length">
        <div class="app-row header cp-grid">
          <span>Anunciante</span>
          <span>Empresa</span>
          <span>Vigencia</span>
          <span>Pos.</span>
          <span>Edificios</span>
          <span>Estado</span>
          <span></span>
        </div>
        <div class="app-row cp-grid" *ngFor="let item of visible; trackBy: trackById">
          <div class="adv-cell">
            <img *ngIf="item.imageUrl" [src]="img(item.imageUrl)" alt="" />
            <div class="name-cell">
              <strong>{{ item.advertiserName }}</strong>
              <small>{{ categoryLabel(item.category) }}</small>
            </div>
          </div>
          <span>{{ item.companyName }}</span>
          <span>{{ item.startDate | date:'dd/MM/yyyy' }} – {{ item.endDate | date:'dd/MM/yyyy' }}</span>
          <span>{{ item.position }}</span>
          <span>{{ item.buildingCount }}</span>
          <p-tag [value]="statusLabel(item)" [severity]="statusSeverity(item)"></p-tag>
          <div class="app-actions">
            <p-button type="button" icon="pi pi-pencil" size="small" severity="secondary" [text]="true" (onClick)="openEdit(item)"></p-button>
            <p-button type="button" [icon]="item.isActive ? 'pi pi-pause' : 'pi pi-play'" size="small" severity="secondary" [text]="true"
                      [disabled]="!!busyId" (onClick)="toggle(item)"></p-button>
            <p-button type="button" icon="pi pi-trash" size="small" severity="danger" [text]="true"
                      [disabled]="!!busyId" (onClick)="askDelete(item)"></p-button>
          </div>
        </div>
      </div>
    </p-card>

    <!-- FORMULARIO -->
    <div class="ov-backdrop" *ngIf="formOpen" (click)="closeForm()"></div>
    <div class="ov-panel" *ngIf="formOpen" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>{{ editing ? 'Editar campaña' : 'Nueva campaña' }}</strong>
        <button class="ov-close" (click)="closeForm()">✕</button>
      </div>

      <label class="field">
        <span>Empresa</span>
        <select [(ngModel)]="form.companyId" name="companyId" [disabled]="!!editing" (ngModelChange)="onCompanyChange()">
          <option value="" disabled>— Seleccionar —</option>
          <option *ngFor="let c of companies" [value]="c.id">{{ c.name }}</option>
        </select>
      </label>

      <label class="field">
        <span>Anunciante</span>
        <input type="text" [(ngModel)]="form.advertiserName" name="advertiserName" maxlength="200" />
      </label>

      <label class="field">
        <span>Descripción <em>(opcional)</em></span>
        <textarea [(ngModel)]="form.description" name="description" rows="2" maxlength="500"></textarea>
      </label>

      <div class="field-row">
        <label class="field">
          <span>Texto del botón</span>
          <input type="text" [(ngModel)]="form.ctaText" name="ctaText" maxlength="60" placeholder="Ej. Pedir ahora" />
        </label>
        <label class="field">
          <span>Enlace del botón <em>(opcional)</em></span>
          <input type="text" [(ngModel)]="form.ctaUrl" name="ctaUrl" maxlength="500" placeholder="https://… o número de WhatsApp" />
        </label>
      </div>

      <div class="field">
        <span>Imagen del banner <em>(JPG o PNG, máx. 2 MB)</em></span>
        <div class="image-row">
          <img *ngIf="form.imageUrl" class="preview" [src]="img(form.imageUrl)" alt="Banner" />
          <button type="button" class="upload-btn" (click)="imageInput.click()" [disabled]="uploading">
            <ng-container *ngIf="!uploading"><i class="pi pi-upload"></i> {{ form.imageUrl ? 'Cambiar imagen' : 'Subir imagen' }}</ng-container>
            <ng-container *ngIf="uploading"><i class="pi pi-spin pi-spinner"></i> Subiendo...</ng-container>
          </button>
          <input #imageInput type="file" accept=".jpg,.jpeg,.png" style="display:none" (change)="onImagePicked($event)" />
        </div>
      </div>

      <div class="field-row">
        <label class="field">
          <span>Categoría</span>
          <select [(ngModel)]="form.category" name="category">
            <option *ngFor="let c of categories" [value]="c.value">{{ c.label }}</option>
          </select>
        </label>
        <label class="field">
          <span>Posición (1 a 7)</span>
          <select [(ngModel)]="form.position" name="position">
            <option *ngFor="let p of positions" [ngValue]="p">{{ p }}</option>
          </select>
        </label>
      </div>

      <div class="field-row">
        <label class="field">
          <span>Desde</span>
          <input type="date" [(ngModel)]="form.startDate" name="startDate" />
        </label>
        <label class="field">
          <span>Hasta</span>
          <input type="date" [(ngModel)]="form.endDate" name="endDate" />
        </label>
      </div>

      <label class="field">
        <span>Monto mensual (Gs.) <em>(opcional, solo interno)</em></span>
        <input type="number" [(ngModel)]="form.monthlyAmount" name="monthlyAmount" min="0" />
      </label>

      <div class="field">
        <span>Edificios</span>
        <p class="hint" *ngIf="!form.companyId">Elegí primero la empresa.</p>
        <p class="hint" *ngIf="form.companyId && !companyBuildings.length">
          Esta empresa no tiene edificios con la publicidad activada. Activala en «Edificios».
        </p>
        <div class="buildings-box" *ngIf="companyBuildings.length">
          <label class="checkbox" *ngFor="let b of companyBuildings">
            <input type="checkbox" [checked]="form.buildingIds.includes(b.buildingId)" (change)="toggleBuilding(b.buildingId)" />
            <span>{{ b.buildingName }}<small *ngIf="!b.adsEnabled" class="warn"> · publicidad apagada</small></span>
          </label>
        </div>
      </div>

      <label class="checkbox">
        <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" />
        <span>Campaña activa</span>
      </label>
      <label class="checkbox">
        <input type="checkbox" [(ngModel)]="form.notifyBeforeExpiry" name="notifyBeforeExpiry" />
        <span>Avisarme 7 días antes de que venza</span>
      </label>

      <p class="form-error" *ngIf="formError">{{ formError }}</p>

      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" [disabled]="saving" (onClick)="closeForm()"></p-button>
        <p-button label="Guardar" icon="pi pi-check" [loading]="saving" [disabled]="uploading" (onClick)="save()"></p-button>
      </div>
    </div>

    <!-- CONFIRMAR ELIMINAR -->
    <div class="ov-backdrop" *ngIf="deleteTarget" (click)="deleteTarget = null; cdr.markForCheck()"></div>
    <div class="ov-panel ov-sm" *ngIf="deleteTarget" (click)="$event.stopPropagation()">
      <div class="ov-header">
        <strong>Eliminar campaña</strong>
        <button class="ov-close" (click)="deleteTarget = null; cdr.markForCheck()">✕</button>
      </div>
      <p>¿Eliminar la campaña de <strong>{{ deleteTarget.advertiserName }}</strong>? Deja de mostrarse en la app.</p>
      <div class="confirm-footer">
        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="deleteTarget = null; cdr.markForCheck()"></p-button>
        <p-button label="Eliminar" severity="danger" [loading]="!!busyId" (onClick)="confirmDelete()"></p-button>
      </div>
    </div>
  `,
  styles: [`
    .toolbar-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .filters { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .filters input, .filters select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .filters .search { flex: 1 1 260px; min-width: 200px; }
    .cp-grid { grid-template-columns: 2.4fr 1.4fr 1.8fr 0.5fr 0.8fr 1fr 1.3fr; }
    .adv-cell { display: flex; align-items: center; gap: 0.7rem; }
    .adv-cell img { width: 56px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(19,133,182,0.15); }
    .name-cell { display: flex; flex-direction: column; gap: 0.2rem; align-items: flex-start; }
    .name-cell small { color: var(--brand-muted); }
    @media (max-width: 1100px) { .cp-grid { grid-template-columns: 1fr; } .app-row.header { display: none; } .app-actions { justify-content: flex-start; } }

    .ov-backdrop { position: fixed; inset: 0; background: rgba(15,35,50,0.45); z-index: 1000; backdrop-filter: blur(2px); }
    .ov-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: min(640px, calc(100vw - 2rem)); max-height: 92vh; overflow-y: auto;
      background: #fff; border-radius: 24px; z-index: 1001;
      box-shadow: 0 32px 80px rgba(15,40,60,0.28); padding: 1.6rem;
    }
    .ov-panel.ov-sm { width: min(440px, calc(100vw - 2rem)); }
    .ov-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(19,133,182,0.1); }
    .ov-header strong { font-size: 1.2rem; color: var(--brand-ink); }
    .ov-close { background: none; border: none; cursor: pointer; font-size: 1.1rem; color: var(--brand-muted); width: 32px; height: 32px; border-radius: 50%; }
    .ov-close:hover { background: rgba(19,133,182,0.08); color: var(--brand-ink); }
    .field { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.9rem; color: var(--brand-ink); font-weight: 600; font-size: 0.92rem; }
    .field em { font-weight: 400; font-style: normal; color: var(--brand-muted); font-size: 0.82rem; }
    .field input:not([type=checkbox]), .field textarea, .field select {
      padding: 0.55rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-weight: 400; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .field textarea { resize: vertical; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
    @media (max-width: 560px) { .field-row { grid-template-columns: 1fr; } }
    .image-row { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
    .preview { width: 140px; height: 80px; object-fit: cover; border-radius: 10px; border: 1px solid rgba(19,133,182,0.2); }
    .upload-btn {
      padding: 0.55rem 1rem; border: 2px dashed rgba(19,133,182,0.3); border-radius: 12px; background: none; cursor: pointer;
      color: var(--brand-muted); font: inherit; font-weight: 500;
    }
    .upload-btn:hover:not(:disabled) { border-color: var(--brand-blue); color: var(--brand-blue); }
    .buildings-box { display: flex; flex-direction: column; gap: 0.4rem; max-height: 180px; overflow-y: auto; padding: 0.6rem 0.8rem; border: 1px solid rgba(19,133,182,0.2); border-radius: 10px; }
    .checkbox { display: flex; align-items: center; gap: 0.6rem; margin-top: 0.7rem; color: var(--brand-ink); font-weight: 500; }
    .checkbox input { width: 16px; height: 16px; accent-color: var(--brand-blue); }
    .warn { color: #b45309; }
    .hint { margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--brand-muted); font-weight: 400; }
    .form-error { margin: 0.9rem 0 0; color: #b42318; font-size: 0.9rem; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.4rem; }
  `]
})
export class AdCampaignsPageComponent implements OnInit {
  private readonly api = inject(AdCampaignsApiService);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly msg = inject(MessageService);
  readonly cdr = inject(ChangeDetectorRef);

  readonly categories = CATEGORIES;
  readonly positions = [1, 2, 3, 4, 5, 6, 7];
  readonly img = resolveUploadUrl;

  items: AdCampaign[] = [];
  buildings: AdBuilding[] = [];
  companies: Company[] = [];
  loading = true;
  pageError = '';
  search = '';
  filter: 'all' | 'live' | 'paused' | 'expired' = 'all';

  formOpen = false;
  editing: AdCampaign | null = null;
  form: CampaignForm = this.emptyForm();
  formError = '';
  saving = false;
  uploading = false;

  deleteTarget: AdCampaign | null = null;
  busyId = '';

  ngOnInit(): void { this.load(); }

  private load(): void {
    forkJoin({
      campaigns: this.api.getAll(),
      buildings: this.api.getBuildings(),
      companies: this.companiesApi.getAll()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ campaigns, buildings, companies }) => {
        this.items = campaigns;
        this.buildings = buildings;
        this.companies = companies;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.pageError = extractApiErrorMessage(err, 'No se pudieron cargar las campañas.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Listado ──────────────────────────────────────────────────────────────
  private isExpired(c: AdCampaign): boolean {
    return c.endDate.slice(0, 10) < this.today();
  }

  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get visible(): AdCampaign[] {
    const term = this.search.trim().toLowerCase();
    return this.items.filter(c => {
      if (term && !`${c.advertiserName} ${c.companyName}`.toLowerCase().includes(term)) return false;
      switch (this.filter) {
        case 'live': return c.isActive && !this.isExpired(c) && c.startDate.slice(0, 10) <= this.today();
        case 'paused': return !c.isActive;
        case 'expired': return this.isExpired(c);
        default: return true;
      }
    });
  }

  trackById(_: number, c: AdCampaign): string { return c.id; }

  categoryLabel(value: string): string { return this.categories.find(c => c.value === value)?.label ?? value; }

  statusLabel(c: AdCampaign): string {
    if (this.isExpired(c)) return 'Vencida';
    if (!c.isActive) return 'Pausada';
    return c.startDate.slice(0, 10) > this.today() ? 'Programada' : 'Vigente';
  }

  statusSeverity(c: AdCampaign): 'success' | 'warn' | 'secondary' | 'info' {
    if (this.isExpired(c)) return 'secondary';
    if (!c.isActive) return 'warn';
    return c.startDate.slice(0, 10) > this.today() ? 'info' : 'success';
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  private emptyForm(): CampaignForm {
    return {
      companyId: '', advertiserName: '', description: '', ctaText: '', ctaUrl: '', imageUrl: '',
      category: 'Otro', position: 1, startDate: '', endDate: '', monthlyAmount: null,
      isActive: true, notifyBeforeExpiry: true, buildingIds: []
    };
  }

  // Edificios que se pueden elegir: los de la empresa con la publicidad activada, más los que la campaña ya tenía.
  get companyBuildings(): AdBuilding[] {
    if (!this.form.companyId) return [];
    const assigned = new Set(this.editing?.buildingIds ?? []);
    return this.buildings.filter(b => b.companyId === this.form.companyId && (b.adsEnabled || assigned.has(b.buildingId)));
  }

  openNew(): void {
    this.editing = null;
    this.form = this.emptyForm();
    this.formError = '';
    this.formOpen = true;
  }

  openEdit(c: AdCampaign): void {
    this.editing = c;
    this.form = {
      companyId: c.companyId,
      advertiserName: c.advertiserName,
      description: c.description ?? '',
      ctaText: c.ctaText,
      ctaUrl: c.ctaUrl ?? '',
      imageUrl: c.imageUrl,
      category: c.category,
      position: c.position,
      startDate: c.startDate.slice(0, 10),
      endDate: c.endDate.slice(0, 10),
      monthlyAmount: c.monthlyAmount,
      isActive: c.isActive,
      notifyBeforeExpiry: c.notifyBeforeExpiry,
      buildingIds: [...c.buildingIds]
    };
    this.formError = '';
    this.formOpen = true;
  }

  closeForm(): void {
    if (this.saving) return;
    this.formOpen = false;
  }

  onCompanyChange(): void {
    this.form.buildingIds = [];
  }

  toggleBuilding(id: string): void {
    this.form.buildingIds = this.form.buildingIds.includes(id)
      ? this.form.buildingIds.filter(x => x !== id)
      : [...this.form.buildingIds, id];
  }

  onImagePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      this.formError = 'La imagen supera el límite de 2 MB.';
      this.cdr.markForCheck();
      return;
    }

    this.uploading = true;
    this.formError = '';
    this.api.uploadImage(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ imageUrl }) => {
        this.form.imageUrl = imageUrl;
        this.uploading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.uploading = false;
        this.formError = extractApiErrorMessage(err, 'No se pudo subir la imagen.');
        this.cdr.markForCheck();
      }
    });
  }

  save(): void {
    if (this.saving) return;
    const f = this.form;

    if (!f.companyId) { this.formError = 'Elegí la empresa.'; return; }
    if (!f.advertiserName.trim()) { this.formError = 'El nombre del anunciante es obligatorio.'; return; }
    if (!f.ctaText.trim()) { this.formError = 'El texto del botón es obligatorio.'; return; }
    if (!f.imageUrl) { this.formError = 'Subí la imagen del banner.'; return; }
    if (!f.startDate || !f.endDate) { this.formError = 'Indicá las fechas de inicio y fin.'; return; }
    if (f.endDate <= f.startDate) { this.formError = 'La fecha de fin debe ser posterior a la de inicio.'; return; }
    if (!f.buildingIds.length) { this.formError = 'Elegí al menos un edificio.'; return; }

    const request: AdCampaignCreateRequest = {
      companyId: f.companyId,
      advertiserName: f.advertiserName.trim(),
      description: f.description.trim() || null,
      ctaText: f.ctaText.trim(),
      ctaUrl: f.ctaUrl.trim() || null,
      imageUrl: f.imageUrl,
      category: f.category,
      position: Number(f.position),
      startDate: f.startDate,
      endDate: f.endDate,
      monthlyAmount: f.monthlyAmount === null || f.monthlyAmount === undefined || `${f.monthlyAmount}` === '' ? null : Number(f.monthlyAmount),
      isActive: f.isActive,
      notifyBeforeExpiry: f.notifyBeforeExpiry,
      buildingIds: f.buildingIds
    };

    this.formError = '';
    this.saving = true;
    const op = this.editing
      ? this.api.update(this.editing.id, (({ companyId, ...rest }) => rest)(request))
      : this.api.create(request);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.items = this.editing
          ? this.items.map(x => (x.id === saved.id ? saved : x))
          : [saved, ...this.items];
        this.saving = false;
        this.formOpen = false;
        this.msg.add({ severity: 'success', summary: 'Guardado', detail: 'Campaña guardada.', life: 4000 });
        this.refreshBuildings();
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.formError = extractApiErrorMessage(err, 'No se pudo guardar la campaña.');
        this.cdr.markForCheck();
      }
    });
  }

  // El conteo de campañas por edificio cambia al guardar, pausar o eliminar.
  private refreshBuildings(): void {
    this.api.getBuildings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: buildings => { this.buildings = buildings; this.cdr.markForCheck(); }
    });
  }

  // ── Acciones de fila ─────────────────────────────────────────────────────
  toggle(c: AdCampaign): void {
    if (this.busyId) return;
    this.busyId = c.id;
    this.api.toggle(c.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.items = this.items.map(x => (x.id === updated.id ? updated : x));
        this.busyId = '';
        this.refreshBuildings();
        this.cdr.markForCheck();
      },
      error: err => {
        this.busyId = '';
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo cambiar el estado.'), life: 6000 });
        this.cdr.markForCheck();
      }
    });
  }

  askDelete(c: AdCampaign): void { this.deleteTarget = c; }

  confirmDelete(): void {
    const target = this.deleteTarget;
    if (!target || this.busyId) return;
    this.busyId = target.id;
    this.api.delete(target.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.items = this.items.filter(x => x.id !== target.id);
        this.busyId = '';
        this.deleteTarget = null;
        this.refreshBuildings();
        this.cdr.markForCheck();
      },
      error: err => {
        this.busyId = '';
        this.deleteTarget = null;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(err, 'No se pudo eliminar la campaña.'), life: 6000 });
        this.cdr.markForCheck();
      }
    });
  }
}
