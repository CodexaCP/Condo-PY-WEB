import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { ExpenseChargesApiService } from '../../api/expense-charges-api.service';
import { ExpensePeriodsApiService } from '../../api/expense-periods-api.service';
import { AuthService } from '../../auth/auth.service';
import { ExpenseCharge, ExpenseChargeType, ExpenseSettlementChargePreview } from '../../api/models';

interface ChargeLine {
  id: string | null;
  concept: string;
  typeLabel: string;
  origin: string;
  amount: number;
  badges: { text: string; kind: 'legacy' | 'late' | 'adjust' | 'reversed' }[];
  isManual: boolean;
}

interface UnitCharges {
  unitCode: string;
  buildingName: string;
  total: number;
  lines: ChargeLine[];
  expanded: boolean;
}

const TYPE_LABELS: Record<ExpenseChargeType, string> = {
  Ordinary: 'Ordinaria', ReserveFund: 'Fondo reserva', Extraordinary: 'Extraordinario', Individual: 'Individual', Adjustment: 'Ajuste'
};

// Seccion "Cargos" de Gastos y cargos: solo lectura. En borrador muestra lo que saldria de los gastos al aprobar la
// liquidacion; ya aprobada, los cargos reales con el gasto de donde vienen. Los cargos manuales anteriores (legacy) se
// listan aparte y solo se pueden limpiar mientras el periodo siga en borrador.
@Component({
  standalone: true,
  selector: 'app-period-charges-section',
  imports: [CommonModule, FormsModule, Button, Tag, Tooltip],
  template: `
    <div class="charges-section">
      <p class="app-state" *ngIf="!periodId">Elegí un edificio y un periodo para ver los cargos por unidad.</p>
      <p class="app-state" *ngIf="periodId && loading">Cargando cargos...</p>

      <ng-container *ngIf="periodId && !loading">
        <!-- Cargos manuales anteriores (legacy) -->
        <div class="legacy-box" *ngIf="legacyLines.length">
          <div class="legacy-head">
            <span class="pi pi-exclamation-triangle"></span>
            <div>
              <strong>{{ legacyLines.length }} cargo(s) manual(es) anterior(es) (legacy)</strong>
              <small>Ya no se crean cargos a mano: los cargos salen de los gastos. Estos no vienen de la liquidación y bloquean su aprobación.</small>
            </div>
            <p-button *ngIf="canCleanLegacy && periodStatus === 'Draft'" type="button" label="Eliminar todos" icon="pi pi-trash" severity="danger" size="small"
              [outlined]="true" [loading]="cleaning" (onClick)="cleanAllLegacy()"></p-button>
          </div>
          <div class="legacy-row" *ngFor="let line of legacyLines">
            <span><strong>{{ line.unitCode }}</strong> · {{ line.concept }}</span>
            <span class="amount">{{ formatCurrency(line.amount) }}</span>
            <p-button *ngIf="canCleanLegacy && periodStatus === 'Draft'" type="button" icon="pi pi-trash" severity="danger" [rounded]="true" [text]="true"
              [disabled]="cleaning" pTooltip="Eliminar cargo legacy" (onClick)="deleteLegacy(line.id!)"></p-button>
          </div>
        </div>

        <!-- Aviso de vista previa -->
        <div class="preview-banner" *ngIf="showingPreview">
          <span class="pi pi-eye"></span>
          <div>
            <strong>Vista previa</strong>
            <small>Todavía no hay cargos emitidos. Esto es lo que se cobrará a cada unidad al aprobar la liquidación, con los gastos, ingresos y aportes de hoy.</small>
          </div>
        </div>
        <p-tag *ngIf="previewError" severity="danger" [value]="previewError"></p-tag>

        <div class="search-row" *ngIf="groups.length || search">
          <span class="pi pi-search"></span>
          <input type="text" [(ngModel)]="search" name="chargeSearch" (ngModelChange)="rebuild()" placeholder="Buscar por unidad o concepto..." />
          <span class="total-chip">Total: <strong>{{ formatCurrency(grandTotal) }}</strong> · {{ groups.length }} unidades</span>
        </div>

        <p class="app-state" *ngIf="!groups.length && !previewError">{{ search ? 'Ningún resultado coincide con la búsqueda.' : 'Este periodo todavía no tiene cargos.' }}</p>

        <div class="app-list" *ngIf="groups.length">
          <ng-container *ngFor="let g of groups">
            <div class="app-row unit-row" (click)="g.expanded = !g.expanded">
              <span><strong>{{ g.unitCode }}</strong> <small>· {{ g.lines.length }} concepto{{ g.lines.length === 1 ? '' : 's' }}</small></span>
              <span class="building">{{ g.buildingName }}</span>
              <span class="amount" [class.negative]="g.total < 0"><strong>{{ formatCurrency(g.total) }}</strong></span>
              <span class="pi" [ngClass]="g.expanded ? 'pi-chevron-up' : 'pi-chevron-down'"></span>
            </div>
            <div class="app-row line-row" *ngFor="let line of (g.expanded ? g.lines : [])">
              <span>
                {{ line.concept }}
                <small class="origin" *ngIf="line.origin">· Origen: {{ line.origin }}</small>
                <span class="badge" [ngClass]="'b-' + b.kind" *ngFor="let b of line.badges">{{ b.text }}</span>
              </span>
              <span>{{ line.typeLabel }}</span>
              <span class="amount" [class.negative]="line.amount < 0">{{ formatCurrency(line.amount) }}</span>
              <span></span>
            </div>
          </ng-container>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .search-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.9rem; flex-wrap: wrap; }
    .search-row input { flex: 1; min-width: 200px; max-width: 360px; border: 1.5px solid rgba(20,54,61,0.18); border-radius: 10px; padding: 0.5rem 0.75rem; font-size: 0.92rem; }
    .total-chip { margin-left: auto; font-size: 0.9rem; color: var(--brand-muted); }
    .app-row { display: grid; grid-template-columns: 2.2fr 1.4fr 1fr 2rem; align-items: center; gap: 0.5rem; }
    .unit-row { cursor: pointer; background: rgba(20,54,61,0.04); }
    .line-row { padding-left: 1.5rem; font-size: 0.9rem; }
    .amount { text-align: right; font-family: monospace; }
    .negative { color: #b45309; }
    .building { color: var(--brand-muted); font-size: 0.85rem; }
    .origin { color: var(--brand-muted); }
    .badge { margin-left: 0.4rem; padding: 0.05rem 0.45rem; border-radius: 8px; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
    .b-legacy { background: rgba(234,88,12,0.12); color: #c2410c; }
    .b-late { background: rgba(220,38,38,0.1); color: #b91c1c; }
    .b-adjust { background: rgba(99,102,241,0.12); color: #4338ca; }
    .b-reversed { background: rgba(0,0,0,0.08); color: var(--brand-muted); }
    .legacy-box { border: 1.5px solid rgba(234,88,12,0.35); background: rgba(255,247,237,0.8); border-radius: 12px; padding: 0.8rem 1rem; margin-bottom: 1rem; display: grid; gap: 0.4rem; }
    .legacy-head { display: flex; align-items: center; gap: 0.75rem; }
    .legacy-head .pi { color: #c2410c; font-size: 1.2rem; }
    .legacy-head div { flex: 1; display: grid; }
    .legacy-head small { color: var(--brand-muted); }
    .legacy-row { display: grid; grid-template-columns: 1fr auto 2.5rem; align-items: center; gap: 0.5rem; padding: 0.2rem 0; font-size: 0.9rem; }
    .preview-banner { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 1rem; border-radius: 12px; background: rgba(19,133,182,0.08); border: 1px solid rgba(19,133,182,0.25); margin-bottom: 1rem; }
    .preview-banner .pi { color: var(--brand-blue); font-size: 1.2rem; }
    .preview-banner div { display: grid; }
    .preview-banner small { color: var(--brand-muted); }
  `]
})
export class PeriodChargesSectionComponent implements OnChanges {
  private readonly chargesApi = inject(ExpenseChargesApiService);
  private readonly periodsApi = inject(ExpensePeriodsApiService);
  private readonly auth = inject(AuthService);
  private readonly msg = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() periodId = '';
  @Input() periodStatus = '';
  // Se avisa cuando cambian los cargos (por ejemplo, al limpiar los legacy) para refrescar la conciliacion.
  @Output() changed = new EventEmitter<void>();

  loading = false;
  cleaning = false;
  search = '';
  previewError = '';
  showingPreview = false;
  groups: UnitCharges[] = [];
  legacyLines: (ChargeLine & { unitCode: string })[] = [];
  grandTotal = 0;

  private charges: ExpenseCharge[] = [];
  private preview: ExpenseSettlementChargePreview | null = null;

  get canCleanLegacy(): boolean { return this.auth.hasRole('SuperAdmin', 'CompanyAdmin', 'BuildingManager'); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['periodId'] || changes['periodStatus']) this.load();
  }

  load(): void {
    if (!this.periodId) {
      this.charges = []; this.preview = null; this.rebuild();
      return;
    }
    this.loading = true;
    this.previewError = '';
    forkJoin({
      charges: this.chargesApi.getAll({ expensePeriodId: this.periodId }),
      // La vista previa solo tiene sentido mientras el periodo esta en borrador.
      preview: this.periodStatus === 'Draft'
        ? this.periodsApi.getChargesPreview(this.periodId).pipe(
            catchError(error => { this.previewError = extractApiErrorMessage(error, 'No se pudo calcular la vista previa.'); return of(null); }))
        : of(null)
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ charges, preview }) => {
        this.charges = charges;
        this.preview = preview;
        this.loading = false;
        this.rebuild();
      },
      error: error => {
        this.loading = false;
        this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudieron cargar los cargos.'), life: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  rebuild(): void {
    const legacy = this.charges.filter(c => c.isManual);
    this.legacyLines = legacy.map(c => ({ ...this.toLine(c), unitCode: c.unitCode }));

    const emitted = this.charges.filter(c => !c.isManual);
    const hasSettlementCharges = emitted.some(c => c.sourceSettlementId);
    this.showingPreview = !!this.preview && !hasSettlementCharges && this.periodStatus === 'Draft';

    const byUnit = new Map<string, UnitCharges>();
    const add = (unitCode: string, buildingName: string, line: ChargeLine) => {
      let g = byUnit.get(unitCode);
      if (!g) { g = { unitCode, buildingName, total: 0, lines: [], expanded: false }; byUnit.set(unitCode, g); }
      g.lines.push(line); g.total += line.amount;
    };

    if (this.showingPreview && this.preview) {
      for (const item of this.preview.items) {
        add(item.unitCode, this.preview.buildingName, {
          id: null, concept: item.concept, typeLabel: TYPE_LABELS[item.chargeType], origin: '', amount: item.amount, badges: [], isManual: false
        });
      }
      // La mora y los ajustes que ya existan se muestran igual junto a la vista previa.
      for (const c of emitted) add(c.unitCode, c.buildingName, this.toLine(c));
    } else {
      for (const c of emitted) add(c.unitCode, c.buildingName, this.toLine(c));
    }

    const q = this.search.trim().toLowerCase();
    const previouslyOpen = new Set(this.groups.filter(g => g.expanded).map(g => g.unitCode));
    this.groups = [...byUnit.values()]
      .filter(g => !q || g.unitCode.toLowerCase().includes(q) || g.lines.some(l => l.concept.toLowerCase().includes(q)))
      .sort((a, b) => a.unitCode.localeCompare(b.unitCode, undefined, { numeric: true }))
      .map(g => ({ ...g, expanded: previouslyOpen.has(g.unitCode) || !!q }));
    this.grandTotal = this.groups.reduce((sum, g) => sum + g.total, 0);
    this.cdr.markForCheck();
  }

  deleteLegacy(id: string): void {
    this.cleaning = true;
    this.chargesApi.delete(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.cleaning = false; this.afterClean('Cargo legacy eliminado.'); },
      error: error => this.failClean(error)
    });
  }

  cleanAllLegacy(): void {
    const ids = this.legacyLines.map(l => l.id!).filter(Boolean);
    if (!ids.length) return;
    this.cleaning = true;
    forkJoin(ids.map(id => this.chargesApi.delete(id))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.cleaning = false; this.afterClean(`${ids.length} cargos legacy eliminados.`); },
      error: error => this.failClean(error)
    });
  }

  formatCurrency(value: number): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  private afterClean(detail: string): void {
    this.msg.add({ severity: 'success', summary: 'Listo', detail, life: 4000 });
    this.changed.emit();
    this.load();
  }

  private failClean(error: unknown): void {
    this.cleaning = false;
    this.msg.add({ severity: 'error', summary: 'Error', detail: extractApiErrorMessage(error, 'No se pudo eliminar el cargo.'), life: 6000 });
    this.cdr.markForCheck();
  }

  private toLine(c: ExpenseCharge): ChargeLine {
    const badges: ChargeLine['badges'] = [];
    if (c.isManual) badges.push({ text: 'Legacy', kind: 'legacy' });
    if (c.isLateFee) badges.push({ text: 'Mora', kind: 'late' });
    if (c.isReversal) badges.push({ text: 'Ajuste', kind: 'adjust' });
    if (c.isReversed) badges.push({ text: 'Revertido', kind: 'reversed' });
    return {
      id: c.id,
      concept: c.concept,
      typeLabel: TYPE_LABELS[c.chargeType],
      origin: c.sourceBuildingExpenseDescription || (c.sourceSettlementName ? `Liquidación ${c.sourceSettlementName}` : ''),
      amount: c.amount,
      badges,
      isManual: c.isManual
    };
  }
}
