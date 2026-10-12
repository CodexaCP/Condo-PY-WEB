import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingConfigApiService } from '../../api/building-config-api.service';
import { BuildingConfigOverview, ConfigSection, ConfigSectionStatus } from '../../api/building-config.models';
import { Building } from '../../api/models';
import { ConfigAuditSectionComponent } from './config-audit-section.component';
import { ConfigClosingSectionComponent } from './config-closing-section.component';
import { ConfigFundsSectionComponent } from './config-funds-section.component';
import { ConfigLateFeeSectionComponent } from './config-late-fee-section.component';
import { ConfigNoticesSectionComponent } from './config-notices-section.component';
import { ConfigSuppliersSectionComponent } from './config-suppliers-section.component';
import { ConfigTaxesSectionComponent } from './config-taxes-section.component';
import { ConfigBuildingPickerComponent } from './config-building-picker.component';

// Las secciones «self» se editan dentro del propio Centro (se abren con ?section=<clave>); el historial es una más.
export const AUDIT_SECTION = 'audit';

// Pantallas de Finanzas a las que lleva una sección con enlace «finance» (según su pestaña).
const FINANCE_LINKS: Record<string, string> = {
  settings: '/finance/settings',
  budget: '/finance/budget',
  reconciliation: '/finance/reconciliation'
};

const STATUS_LABELS: Record<ConfigSectionStatus, string> = {
  Complete: 'Completa',
  Incomplete: 'Incompleta',
  Optional: 'Opcional',
  NotAvailable: 'No disponible'
};

const STATUS_SEVERITIES: Record<ConfigSectionStatus, 'success' | 'warn' | 'info' | 'secondary'> = {
  Complete: 'success',
  Incomplete: 'warn',
  Optional: 'info',
  NotAvailable: 'secondary'
};

// Centro de configuración del edificio: un solo lugar que dice si el edificio está listo para operar y qué falta, con el estado de cada
// sección (identidad y fiscal, cobro, mora, fondos, plan de cuentas, impuestos, proveedores, cierre, presupuesto, conciliación, asientos y
// avisos) y el acceso a donde se edita cada una. Envuelve la ficha del edificio y las pantallas de Finanzas: no las reemplaza.
@Component({
  standalone: true,
  selector: 'app-building-config-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink, Card, Message, Tag, ConfigBuildingPickerComponent, ConfigAuditSectionComponent, ConfigClosingSectionComponent,
    ConfigFundsSectionComponent, ConfigLateFeeSectionComponent, ConfigNoticesSectionComponent, ConfigSuppliersSectionComponent, ConfigTaxesSectionComponent
  ],
  template: `
    <p-card styleClass="app-page-card">
      <div class="app-toolbar">
        <div class="app-page-head">
          <div>
            <h1>Centro de configuración</h1>
            <p>Todo lo que hace falta para que el edificio opere, en un solo lugar.</p>
          </div>
        </div>
        <app-config-building-picker (selected)="onBuilding($event)" (failed)="onError($event)"></app-config-building-picker>
      </div>

      <p-message *ngIf="noBuilding" severity="warn" text="No tenés edificios para configurar."></p-message>
      <p-message *ngIf="error" severity="error" [text]="error"></p-message>
      <p class="app-state" *ngIf="loading">Cargando...</p>

      <ng-container *ngIf="overview as o">
        <ng-container *ngIf="!section">
          <div class="ready" [class.ok]="o.readyToOperate">
            <div class="ready-text">
              <strong>{{ o.readyToOperate ? 'Listo para operar' : 'Faltan pasos para operar' }}</strong>
              <span>{{ o.readyCount }} de {{ o.requiredCount }} secciones obligatorias completas</span>
            </div>
            <div class="bar" role="progressbar" [attr.aria-valuenow]="percent(o)" aria-valuemin="0" aria-valuemax="100">
              <div class="bar-fill" [style.width.%]="percent(o)"></div>
            </div>
          </div>

          <p-message *ngIf="!o.financeAvailable" severity="info"
                     text="El módulo Finanzas del edificio no está disponible en este edificio: las secciones que dependen de él figuran como no disponibles."></p-message>

          <div class="grid">
            <article class="card" *ngFor="let s of o.sections" [class.incomplete]="s.status === 'Incomplete'">
              <header>
                <h3>{{ s.name }}</h3>
                <div class="tags">
                  <p-tag *ngIf="s.required" value="Obligatoria" severity="contrast" styleClass="tag-sm"></p-tag>
                  <p-tag [value]="statusLabel(s.status)" [severity]="statusSeverity(s.status)" styleClass="tag-sm"></p-tag>
                </div>
              </header>

              <ul class="reasons" *ngIf="s.reasons.length">
                <li *ngFor="let r of s.reasons">{{ r }}</li>
              </ul>

              <dl class="summary" *ngIf="s.summary.length">
                <ng-container *ngFor="let i of s.summary">
                  <dt>{{ i.label }}</dt>
                  <dd>{{ i.value || '—' }}</dd>
                </ng-container>
              </dl>

              <footer *ngIf="action(s) as a">
                <a *ngIf="a.kind === 'link'" class="btn" [routerLink]="a.link" [queryParams]="a.queryParams">{{ s.canEdit ? 'Configurar' : 'Ver' }}</a>
                <button *ngIf="a.kind === 'panel'" type="button" class="btn" (click)="openSection(s.key)">{{ s.canEdit ? 'Configurar' : 'Ver' }}</button>
              </footer>
            </article>
          </div>

          <div class="audit-link" *ngIf="o.canViewAudit">
            <button type="button" class="btn secondary" (click)="openSection(auditKey)">Ver historial de cambios</button>
          </div>
        </ng-container>

        <ng-container *ngIf="section">
          <button type="button" class="back" (click)="openSection(null)">← Volver al Centro</button>
          <ng-container [ngSwitch]="section">
            <app-config-closing-section *ngSwitchCase="'closing'" [buildingId]="o.buildingId"></app-config-closing-section>
            <app-config-late-fee-section *ngSwitchCase="'late-fee'" [buildingId]="o.buildingId"></app-config-late-fee-section>
            <app-config-funds-section *ngSwitchCase="'funds'" [buildingId]="o.buildingId"></app-config-funds-section>
            <app-config-notices-section *ngSwitchCase="'documents'" [buildingId]="o.buildingId"></app-config-notices-section>
            <app-config-taxes-section *ngSwitchCase="'taxes'" [buildingId]="o.buildingId"></app-config-taxes-section>
            <app-config-suppliers-section *ngSwitchCase="'suppliers'" [companyId]="companyId"></app-config-suppliers-section>
            <ng-container *ngSwitchCase="auditKey">
              <app-config-audit-section *ngIf="o.canViewAudit" [buildingId]="o.buildingId" [sections]="o.sections"></app-config-audit-section>
            </ng-container>
          </ng-container>
        </ng-container>
      </ng-container>
    </p-card>
  `,
  styles: [`
    .ready { margin: 0.6rem 0 1.1rem; padding: 1rem 1.2rem; border-radius: 14px; border: 1px solid #e0a23b; background: rgba(224,162,59,0.08); display: grid; gap: 0.6rem; }
    .ready.ok { border-color: #6AC64A; background: rgba(106,198,74,0.1); }
    .ready-text { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: baseline; }
    .ready-text strong { font-size: 1.15rem; color: var(--brand-ink); }
    .ready-text span { color: var(--brand-muted); font-size: 0.9rem; }
    .bar { height: 8px; border-radius: 999px; background: var(--brand-border); overflow: hidden; }
    .bar-fill { height: 100%; background: var(--brand-gradient); border-radius: 999px; transition: width .3s; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(21rem, 1fr)); gap: 0.9rem; margin-top: 1rem; }
    .card { display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem 1.1rem; border: 1px solid var(--brand-border); border-radius: 14px; background: var(--p-content-background, #fff); }
    .card.incomplete { border-color: #e0a23b; }
    .card header { display: flex; justify-content: space-between; gap: 0.6rem; align-items: flex-start; }
    .card h3 { margin: 0; font-size: 1.02rem; color: var(--brand-ink); }
    .tags { display: flex; gap: 0.3rem; flex-wrap: wrap; justify-content: flex-end; }
    :host ::ng-deep .tag-sm .p-tag, :host ::ng-deep .tag-sm.p-tag { font-size: 0.68rem; padding: 0.1rem 0.45rem; }
    .reasons { margin: 0; padding-left: 1.1rem; color: #b7791f; font-size: 0.88rem; display: grid; gap: 0.2rem; }
    .summary { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.8rem; font-size: 0.88rem; }
    .summary dt { color: var(--brand-muted); }
    .summary dd { margin: 0; color: var(--brand-ink); font-weight: 600; text-align: right; overflow-wrap: anywhere; }
    footer { margin-top: auto; padding-top: 0.3rem; }
    .btn { display: inline-block; padding: 0.45rem 1rem; border-radius: 10px; border: none; background: var(--brand-gradient); color: #fff; font: inherit; font-size: 0.88rem; font-weight: 600; cursor: pointer; text-decoration: none; }
    .btn.secondary { background: transparent; border: 1px solid rgba(19,133,182,0.4); color: #1385B6; }
    .audit-link { margin-top: 1.2rem; }
    .back { background: none; border: none; color: #1385B6; font: inherit; font-weight: 600; cursor: pointer; padding: 0; margin: 0.4rem 0 1rem; }
  `]
})
export class BuildingConfigPageComponent {
  private readonly api = inject(BuildingConfigApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly auditKey = AUDIT_SECTION;
  // Claves de las secciones «self» que ya tienen su pantalla dentro del Centro.
  private readonly panelKeys = new Set<string>(['closing', 'late-fee', 'funds', 'documents', 'taxes', 'suppliers']);

  buildingId = '';
  // Empresa del edificio: los proveedores son de la empresa.
  companyId = '';
  overview: BuildingConfigOverview | null = null;
  loading = false;
  noBuilding = false;
  error = '';
  section: string | null = null;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const previous = this.section;
      this.section = params.get('section');
      // Al volver de una sección se recarga el resumen: lo que se guardó cambia su estado.
      if (previous && !this.section && this.buildingId) this.load();
      this.cdr.markForCheck();
    });
  }

  statusLabel(status: ConfigSectionStatus): string { return STATUS_LABELS[status]; }
  statusSeverity(status: ConfigSectionStatus): 'success' | 'warn' | 'info' | 'secondary' { return STATUS_SEVERITIES[status]; }

  percent(o: BuildingConfigOverview): number {
    return o.requiredCount > 0 ? Math.round((o.readyCount / o.requiredCount) * 100) : 0;
  }

  // Qué hace el botón de una sección: llevar a la ficha o a la pantalla de Finanzas, o abrir su editor dentro del Centro.
  action(s: ConfigSection): { kind: 'link'; link: string[]; queryParams: Record<string, string> } | { kind: 'panel' } | null {
    if (s.status === 'NotAvailable' || !s.linkKind || !s.linkTab) return null;

    if (s.linkKind === 'building') {
      return { kind: 'link', link: ['/buildings', this.buildingId], queryParams: { tab: s.linkTab } };
    }

    if (s.linkKind === 'finance') {
      const target = FINANCE_LINKS[s.linkTab];
      return target ? { kind: 'link', link: [target], queryParams: { buildingId: this.buildingId } } : null;
    }

    return this.panelKeys.has(s.linkTab) ? { kind: 'panel' } : null;
  }

  openSection(key: string | null): void {
    void this.router.navigate([], { queryParams: { section: key }, queryParamsHandling: 'merge' });
  }

  onBuilding(building: Building | null): void {
    if (!building) {
      this.noBuilding = true;
      this.cdr.markForCheck();
      return;
    }

    this.noBuilding = false;
    this.buildingId = building.id;
    this.companyId = building.companyId ?? '';
    this.load();
  }

  onError(err: unknown): void {
    this.setError(err);
  }

  private load(): void {
    this.loading = true;
    this.error = '';
    this.overview = null;
    this.api.getOverview(this.buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: overview => {
        this.overview = { ...overview, sections: [...overview.sections].sort((a, b) => a.order - b.order) };
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => this.setError(err)
    });
  }

  private setError(err: unknown): void {
    this.overview = null;
    this.loading = false;
    this.error = extractApiErrorMessage(err, 'No se pudo cargar el Centro de configuración.');
    this.cdr.markForCheck();
  }
}
