import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { Building } from '../../api/models';
import { PaymentConnectionsApiService } from '../../api/payment-connections-api.service';
import {
  PaymentCatalog, PaymentConnection, PaymentConnectionAudit, PaymentConnectionList, PaymentConnectionStatus, PaymentEnvironment,
  PaymentProduct
} from '../../api/payment-connections.models';
import { CONFIG_SECTION_STYLES } from './config-section.styles';

const STATUS_LABELS: Record<PaymentConnectionStatus, string> = {
  Draft: 'Incompleta',
  PendingValidation: 'Pendiente de validación',
  Active: 'Activa',
  Disabled: 'Desactivada'
};

const STATUS_SEVERITIES: Record<PaymentConnectionStatus, 'success' | 'warn' | 'info' | 'secondary'> = {
  Draft: 'secondary',
  PendingValidation: 'warn',
  Active: 'success',
  Disabled: 'secondary'
};

interface ConnectionForm {
  name: string;
  providerCode: string;
  productCode: string;
  environment: PaymentEnvironment;
  settings: Record<string, string>;
  secrets: Record<string, string>;
}

// Pagos online del Centro de configuración: las conexiones de la empresa con el comercio del proveedor (Bancard Tpago o vPOS) y los
// edificios a los que sirve cada una. La empresa es la titular del comercio, así que la configuran el SuperAdmin y el Administrador de toda la
// empresa; el resto ve el estado. Las claves secretas se guardan cifradas y son de solo escritura: se ve cuándo se cargaron y cómo terminan
// (••••1234), nunca su valor. Esta etapa NO cobra: deja la conexión cargada, asignada y lista para cuando se habilite el cobro.
@Component({
  standalone: true,
  selector: 'app-config-payments-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, Message, Tag, DatePipe],
  template: `
    <h2>Pagos online</h2>
    <p class="muted small">
      Conexiones de la empresa con su comercio en el proveedor de pagos y los edificios a los que sirve cada una. El dinero cobrado va directo a la
      cuenta del comercio: Condo-PY solo guarda las claves y registra los resultados.
    </p>

    <p-message *ngIf="!companyId" severity="info" text="El edificio no tiene empresa asignada: no hay conexiones para mostrar."></p-message>
    <p-message *ngIf="error" severity="error" [text]="error"></p-message>
    <div class="notice info" *ngIf="list && !list.collectionEnabled">
      <strong>El cobro online todavía no está habilitado.</strong> Esta configuración deja la conexión cargada y lista; los propietarios seguirán
      pagando como hasta ahora hasta que se habilite el cobro. No registres la dirección de callback en el portal del proveedor todavía.
    </div>
    <div class="notice" *ngIf="list?.canEdit && !list!.masterKeyConfigured">
      <strong>Falta la clave maestra del servidor.</strong> Sin ella no se pueden guardar las claves privadas del comercio. Avisá a soporte para
      configurarla (variable <code>Payments__MasterKey</code> del servicio).
    </div>

    <ng-container *ngIf="companyId">
      <div class="toolbar" *ngIf="list?.canEdit">
        <button type="button" class="btn" (click)="startCreate()" [disabled]="!catalog">Nueva conexión</button>
      </div>

      <!-- Alta y edición -->
      <form class="panel" *ngIf="editing && product" (ngSubmit)="save()" autocomplete="off">
        <h3>{{ editing.id ? 'Editar conexión' : 'Nueva conexión' }}</h3>
        <div class="form">
          <label class="field wide">
            <span>Nombre *</span>
            <input type="text" name="name" maxlength="120" [(ngModel)]="form.name" required placeholder="Ej. Bancard - Administradora Sol" />
            <span class="hint">Para distinguirla de otras conexiones de la empresa.</span>
          </label>
          <label class="field" *ngIf="!editing.id">
            <span>Proveedor</span>
            <select name="provider" [ngModel]="form.providerCode" (ngModelChange)="onProviderChange($event)">
              <option *ngFor="let p of catalog!.providers" [value]="p.code">{{ p.name }}</option>
            </select>
          </label>
          <label class="field" *ngIf="!editing.id">
            <span>Modalidad</span>
            <select name="product" [ngModel]="form.productCode" (ngModelChange)="onProductChange($event)">
              <option *ngFor="let p of providerProducts" [value]="p.code">{{ p.name }}</option>
            </select>
          </label>
          <div class="field wide" *ngIf="editing.id">
            <span>Proveedor y modalidad</span>
            <strong>{{ product.name }}</strong>
            <span class="hint">No se cambian: para otra modalidad se crea otra conexión.</span>
          </div>
          <label class="field">
            <span>Ambiente</span>
            <select name="environment" [(ngModel)]="form.environment">
              <option value="Sandbox">Sandbox (pruebas)</option>
              <option value="Production">Producción</option>
            </select>
            <span class="hint">Pruebas y producción tienen claves distintas: se cargan en conexiones separadas.</span>
          </label>
        </div>

        <p class="muted small">{{ product.description }}</p>

        <h3>Datos del comercio</h3>
        <div class="form">
          <ng-container *ngFor="let f of settingFields">
            <label class="field">
              <span>{{ f.label }}{{ f.required ? ' *' : '' }}</span>
              <input type="text" [name]="'s_' + f.key" [maxLength]="f.maxLength" [(ngModel)]="form.settings[f.key]" autocomplete="off" />
              <span class="hint" *ngIf="f.help">{{ f.help }}</span>
            </label>
          </ng-container>
        </div>

        <h3>Claves secretas</h3>
        <div class="form">
          <ng-container *ngFor="let f of secretFields">
            <label class="field wide">
              <span>{{ f.label }}{{ f.required ? ' *' : '' }}</span>
              <input type="password" [name]="'k_' + f.key" [maxLength]="f.maxLength" [(ngModel)]="form.secrets[f.key]" autocomplete="new-password"
                     [placeholder]="maskedFor(f.key) ? 'Configurada ' + maskedFor(f.key) + ' · dejá vacío para conservarla' : 'Pegá la clave'" />
              <span class="hint" *ngIf="maskedFor(f.key) && editingConnection?.secretsUpdatedAtUtc">
                Última carga: {{ editingConnection!.secretsUpdatedAtUtc | date:'dd/MM/yyyy HH:mm' }}.
              </span>
              <span class="hint" *ngIf="f.help">{{ f.help }}</span>
            </label>
          </ng-container>
        </div>

        <ul class="notes" *ngIf="product.notes.length">
          <li *ngFor="let n of product.notes">{{ n }}</li>
        </ul>

        <div class="actions">
          <button type="submit" class="btn" [disabled]="saving">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
          <button type="button" class="btn secondary" (click)="cancel()">Cancelar</button>
        </div>
      </form>

      <p class="app-state" *ngIf="loading">Cargando...</p>
      <p class="muted" *ngIf="!loading && list && !list.items.length">
        {{ list.canEdit ? 'La empresa todavía no tiene conexiones de pago. Creá la primera con «Nueva conexión».' : 'La empresa todavía no tiene conexiones de pago para este edificio.' }}
      </p>

      <!-- Conexiones -->
      <article class="conn" *ngFor="let c of list?.items" [class.off]="c.status === 'Disabled'">
        <header class="conn-head">
          <div>
            <h3>{{ c.name }}</h3>
            <div class="muted small">{{ c.providerName }} · {{ c.productName }}</div>
          </div>
          <div class="tags">
            <p-tag [value]="c.environment === 'Production' ? 'Producción' : 'Sandbox'" [severity]="c.environment === 'Production' ? 'danger' : 'info'"></p-tag>
            <p-tag [value]="statusLabel(c.status)" [severity]="statusSeverity(c.status)"></p-tag>
          </div>
        </header>

        <div class="chips">
          <span class="chip" *ngFor="let b of c.buildings" [class.here]="b.buildingId === buildingId">
            {{ b.buildingName }}<small *ngIf="b.buildingId === buildingId"> · este edificio</small>
          </span>
          <span class="muted small" *ngIf="!c.buildings.length">No sirve a ningún edificio todavía.</span>
        </div>

        <ng-container *ngIf="list!.canEdit">
          <div class="notice" *ngIf="c.missingFields.length">Faltan datos para activarla: {{ c.missingFields.join(', ') }}.</div>

          <dl class="facts">
            <ng-container *ngFor="let f of fieldsOf(c)">
              <dt>{{ f.label }}</dt>
              <dd>
                <ng-container *ngIf="!f.secret">{{ c.settings?.[f.key] || '—' }}</ng-container>
                <ng-container *ngIf="f.secret">{{ c.secretsMasked?.[f.key] ? c.secretsMasked![f.key] + ' (configurada)' : '—' }}</ng-container>
              </dd>
            </ng-container>
            <dt>Dirección de callback</dt>
            <dd class="callback">
              <code>{{ c.callbackUrl }}</code>
              <button type="button" class="btn sm secondary" (click)="copy(c.callbackUrl)">Copiar</button>
              <span class="muted small" *ngIf="!list!.collectionEnabled">Todavía no recibe avisos: se registra en el proveedor cuando se habilite el cobro.</span>
            </dd>
          </dl>

          <div class="actions">
            <button type="button" class="btn sm secondary" (click)="startEdit(c)">Editar</button>
            <button type="button" class="btn sm secondary" (click)="startBuildings(c)">Edificios</button>
            <button type="button" class="btn sm" *ngIf="c.status !== 'Active'" [disabled]="busyId === c.id" (click)="activate(c)">Activar</button>
            <button type="button" class="btn sm secondary" *ngIf="c.status === 'Active' || c.status === 'PendingValidation'" [disabled]="busyId === c.id" (click)="disable(c)">Desactivar</button>
            <button type="button" class="btn sm secondary" (click)="toggleHistory(c)">Historial</button>
            <button type="button" class="btn sm danger" *ngIf="c.status !== 'Active'" [disabled]="busyId === c.id" (click)="remove(c)">Eliminar</button>
          </div>

          <!-- Edificios de la conexión -->
          <div class="panel inner" *ngIf="buildingsFor?.id === c.id">
            <h3>Edificios de «{{ c.name }}»</h3>
            <p class="muted small">Elegí en qué edificios de la empresa se usa esta conexión. Un edificio puede tener varias conexiones.</p>
            <p class="app-state" *ngIf="!companyBuildings">Cargando edificios...</p>
            <div class="checks" *ngIf="companyBuildings">
              <label class="check" *ngFor="let b of companyBuildings">
                <input type="checkbox" [checked]="buildingsFor!.selected.has(b.id)" (change)="toggleBuilding(b.id)" /> {{ b.name }}
              </label>
              <p class="muted" *ngIf="!companyBuildings.length">La empresa no tiene edificios.</p>
            </div>
            <div class="actions">
              <button type="button" class="btn" [disabled]="saving || !companyBuildings" (click)="saveBuildings()">{{ saving ? 'Guardando...' : 'Guardar edificios' }}</button>
              <button type="button" class="btn secondary" (click)="buildingsFor = null">Cancelar</button>
            </div>
          </div>

          <!-- Historial -->
          <div class="panel inner" *ngIf="historyFor?.id === c.id">
            <h3>Historial de cambios</h3>
            <p class="app-state" *ngIf="!historyFor!.items">Cargando...</p>
            <p class="muted" *ngIf="historyFor!.items && !historyFor!.items!.length">Sin movimientos.</p>
            <ul class="history" *ngIf="historyFor!.items?.length">
              <li *ngFor="let h of historyFor!.items">
                <div>{{ h.summary }}</div>
                <div class="muted small">{{ h.createdAtUtc | date:'dd/MM/yyyy HH:mm' }} · {{ h.userEmail }}</div>
              </li>
            </ul>
          </div>
        </ng-container>
      </article>
    </ng-container>
  `,
  styles: [CONFIG_SECTION_STYLES, `
    .toolbar { display: flex; gap: 0.9rem; align-items: flex-end; flex-wrap: wrap; margin: 0.8rem 0 1rem; }
    .panel { border: 1px solid var(--brand-border); border-radius: 14px; padding: 0.4rem 1.1rem 1rem; margin-bottom: 1rem; background: var(--p-content-background, #fff); }
    .panel.inner { margin-top: 0.8rem; background: rgba(19,133,182,0.03); }
    .panel h3 { margin-top: 0.8rem; }
    .conn { border: 1px solid var(--brand-border); border-radius: 14px; padding: 1rem 1.1rem; margin-bottom: 1rem; background: var(--p-content-background, #fff); }
    .conn.off { opacity: 0.8; }
    .conn-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
    .conn-head h3 { margin: 0 0 0.15rem; }
    .tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .chips { display: flex; gap: 0.4rem; flex-wrap: wrap; margin: 0.6rem 0; align-items: center; }
    .chip { padding: 0.2rem 0.7rem; border-radius: 999px; background: rgba(19,133,182,0.1); font-size: 0.82rem; color: var(--brand-ink); }
    .chip.here { background: var(--brand-blue); color: #fff; }
    .facts { display: grid; grid-template-columns: minmax(10rem, 14rem) 1fr; gap: 0.35rem 1rem; margin: 0.6rem 0; font-size: 0.88rem; }
    .facts dt { color: var(--brand-muted); font-weight: 600; }
    .facts dd { margin: 0; word-break: break-all; }
    .callback { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .callback code { background: rgba(19,133,182,0.08); padding: 0.15rem 0.45rem; border-radius: 6px; }
    .notes { margin: 0.6rem 0; padding-left: 1.2rem; color: var(--brand-muted); font-size: 0.85rem; display: grid; gap: 0.25rem; }
    .history { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; max-height: 22rem; overflow: auto; }
    .history li { padding-bottom: 0.5rem; border-bottom: 1px solid var(--brand-border); font-size: 0.88rem; }
    @media (max-width: 700px) { .facts { grid-template-columns: 1fr; } }
  `]
})
export class ConfigPaymentsSectionComponent implements OnChanges {
  private readonly api = inject(PaymentConnectionsApiService);
  private readonly buildingsApi = inject(BuildingsApiService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  // Empresa del edificio abierto: las conexiones son de la empresa. El SuperAdmin la necesita para ver y crear.
  @Input() companyId = '';
  // Edificio abierto en el Centro: se resalta en las conexiones que lo sirven.
  @Input() buildingId = '';

  catalog: PaymentCatalog | null = null;
  list: PaymentConnectionList | null = null;
  companyBuildings: Building[] | null = null;
  loading = false;
  saving = false;
  busyId = '';
  error = '';

  editing: { id: string | null } | null = null;
  editingConnection: PaymentConnection | null = null;
  form: ConnectionForm = this.emptyForm();
  buildingsFor: { id: string; selected: Set<string> } | null = null;
  historyFor: { id: string; items: PaymentConnectionAudit[] | null } | null = null;

  readonly statusLabel = (s: PaymentConnectionStatus): string => STATUS_LABELS[s] ?? s;
  readonly statusSeverity = (s: PaymentConnectionStatus) => STATUS_SEVERITIES[s] ?? 'secondary';

  get product(): PaymentProduct | null {
    return this.catalog?.providers.find(p => p.code === this.form.providerCode)?.products.find(x => x.code === this.form.productCode) ?? null;
  }

  get providerProducts(): PaymentProduct[] {
    return this.catalog?.providers.find(p => p.code === this.form.providerCode)?.products ?? [];
  }

  get settingFields() { return this.product?.fields.filter(f => !f.secret) ?? []; }
  get secretFields() { return this.product?.fields.filter(f => f.secret) ?? []; }

  fieldsOf(c: PaymentConnection) {
    return this.catalog?.providers.find(p => p.code === c.providerCode)?.products.find(x => x.code === c.productCode)?.fields ?? [];
  }

  maskedFor(key: string): string | null { return this.editingConnection?.secretsMasked?.[key] ?? null; }

  private emptyForm(): ConnectionForm {
    return { name: '', providerCode: '', productCode: '', environment: 'Sandbox', settings: {}, secrets: {} };
  }

  ngOnChanges(): void {
    this.closePanels();
    this.load();
  }

  private closePanels(): void {
    this.editing = null;
    this.editingConnection = null;
    this.buildingsFor = null;
    this.historyFor = null;
  }

  private load(): void {
    if (!this.companyId) return;
    this.loading = true;
    this.error = '';
    forkJoin({ catalog: this.api.getCatalog(), list: this.api.getAll(this.companyId) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ catalog, list }) => {
          this.catalog = catalog;
          this.list = list;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: error => this.fail(error, 'No se pudo cargar la configuración de pagos.', true)
      });
  }

  private fail(error: unknown, fallback: string, stopLoading = false): void {
    this.error = extractApiErrorMessage(error, fallback);
    this.msg.add({ severity: 'error', summary: 'Pagos online', detail: this.error, life: 6000 });
    this.saving = false;
    this.busyId = '';
    if (stopLoading) this.loading = false;
    this.cdr.markForCheck();
  }

  // Reemplaza la conexión en la lista con la que devolvió el servidor.
  private replace(updated: PaymentConnection): void {
    if (!this.list) return;
    this.list = { ...this.list, items: this.list.items.map(x => (x.id === updated.id ? updated : x)) };
  }

  // ─── Alta y edición ──────────────────────────────────────────────────────

  startCreate(): void {
    if (!this.catalog) return;
    const provider = this.catalog.providers[0];
    this.closePanels();
    this.editing = { id: null };
    this.form = { ...this.emptyForm(), providerCode: provider.code, productCode: provider.products[0].code };
  }

  startEdit(c: PaymentConnection): void {
    this.closePanels();
    this.editing = { id: c.id };
    this.editingConnection = c;
    this.form = {
      name: c.name,
      providerCode: c.providerCode,
      productCode: c.productCode,
      environment: c.environment,
      settings: { ...(c.settings ?? {}) },
      secrets: {}
    };
  }

  cancel(): void {
    this.editing = null;
    this.editingConnection = null;
  }

  onProviderChange(code: string): void {
    this.form.providerCode = code;
    this.form.productCode = this.providerProducts[0]?.code ?? '';
    this.form.settings = {};
    this.form.secrets = {};
  }

  onProductChange(code: string): void {
    this.form.productCode = code;
    this.form.settings = {};
    this.form.secrets = {};
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.msg.add({ severity: 'warn', summary: 'Revisá los datos', detail: 'El nombre de la conexión es obligatorio.', life: 5000 });
      return;
    }

    const request = {
      companyId: this.companyId || null,
      name: this.form.name.trim(),
      providerCode: this.form.providerCode,
      productCode: this.form.productCode,
      environment: this.form.environment,
      settings: { ...this.form.settings },
      // Solo viajan las claves que se escribieron: vacío conserva la actual.
      secrets: Object.fromEntries(Object.entries(this.form.secrets).filter(([, v]) => (v ?? '').trim().length > 0))
    };

    const id = this.editing?.id ?? null;
    this.saving = true;
    this.error = '';
    (id ? this.api.update(id, request) : this.api.create(request)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.saving = false;
        this.editing = null;
        this.editingConnection = null;
        if (id) this.replace(saved);
        else if (this.list) this.list = { ...this.list, items: [...this.list.items, saved].sort((a, b) => a.name.localeCompare(b.name)) };
        this.msg.add({ severity: 'success', summary: 'Pagos online', detail: id ? 'Conexión guardada.' : 'Conexión creada.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: error => this.fail(error, 'No se pudo guardar la conexión.')
    });
  }

  // ─── Edificios ───────────────────────────────────────────────────────────

  startBuildings(c: PaymentConnection): void {
    this.closePanels();
    this.buildingsFor = { id: c.id, selected: new Set(c.buildings.map(b => b.buildingId)) };
    if (this.companyBuildings) return;

    this.buildingsApi.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: buildings => {
        this.companyBuildings = buildings.filter(b => b.companyId === this.companyId).sort((a, b) => a.name.localeCompare(b.name));
        this.cdr.markForCheck();
      },
      error: error => this.fail(error, 'No se pudieron cargar los edificios.')
    });
  }

  toggleBuilding(id: string): void {
    const selected = this.buildingsFor?.selected;
    if (!selected) return;
    if (selected.has(id)) selected.delete(id); else selected.add(id);
  }

  saveBuildings(): void {
    const target = this.buildingsFor;
    if (!target) return;

    this.saving = true;
    this.api.setBuildings(target.id, [...target.selected]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.saving = false;
        this.buildingsFor = null;
        this.replace(updated);
        this.msg.add({ severity: 'success', summary: 'Pagos online', detail: 'Edificios guardados.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: error => this.fail(error, 'No se pudieron guardar los edificios.')
    });
  }

  // ─── Estado ──────────────────────────────────────────────────────────────

  activate(c: PaymentConnection): void {
    const message = c.environment === 'Production'
      ? `¿Activar «${c.name}» en PRODUCCIÓN? Es la conexión con el comercio real.`
      : `¿Activar «${c.name}»?`;
    if (!window.confirm(message)) return;

    this.busyId = c.id;
    this.api.activate(c.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.busyId = '';
        this.replace(updated);
        this.msg.add({ severity: 'success', summary: 'Pagos online', detail: 'Conexión activada.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: error => this.fail(error, 'No se pudo activar la conexión.')
    });
  }

  disable(c: PaymentConnection): void {
    if (!window.confirm(`¿Desactivar «${c.name}»? Se conserva toda su configuración.`)) return;

    this.busyId = c.id;
    this.api.disable(c.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.busyId = '';
        this.replace(updated);
        this.msg.add({ severity: 'success', summary: 'Pagos online', detail: 'Conexión desactivada.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: error => this.fail(error, 'No se pudo desactivar la conexión.')
    });
  }

  remove(c: PaymentConnection): void {
    if (!window.confirm(`¿Eliminar «${c.name}»? Se borran sus claves guardadas y no se puede deshacer.`)) return;

    this.busyId = c.id;
    this.api.delete(c.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busyId = '';
        if (this.list) this.list = { ...this.list, items: this.list.items.filter(x => x.id !== c.id) };
        this.msg.add({ severity: 'success', summary: 'Pagos online', detail: 'Conexión eliminada.', life: 4000 });
        this.cdr.markForCheck();
      },
      error: error => this.fail(error, 'No se pudo eliminar la conexión.')
    });
  }

  // ─── Historial y utilidades ──────────────────────────────────────────────

  toggleHistory(c: PaymentConnection): void {
    if (this.historyFor?.id === c.id) {
      this.historyFor = null;
      return;
    }

    this.buildingsFor = null;
    this.historyFor = { id: c.id, items: null };
    this.api.getHistory(c.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        if (this.historyFor?.id === c.id) this.historyFor = { id: c.id, items };
        this.cdr.markForCheck();
      },
      error: error => this.fail(error, 'No se pudo cargar el historial.')
    });
  }

  async copy(text: string | null | undefined): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.msg.add({ severity: 'success', summary: 'Copiado', detail: 'La dirección está en el portapapeles.', life: 3000 });
    } catch {
      this.msg.add({ severity: 'warn', summary: 'No se pudo copiar', detail: 'Seleccioná la dirección y copiala a mano.', life: 4000 });
    }
  }
}
