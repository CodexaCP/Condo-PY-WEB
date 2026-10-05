import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { extractApiErrorMessage } from '../../api/api-error.util';
import { BuildingExpensesApiService } from '../../api/building-expenses-api.service';
import { isPdfUrl, resolveUploadUrl } from '../../api/file-url.util';
import { BuildingExpense, BuildingExpenseCreditNote, BuildingExpenseCreditNotePreview } from '../../api/models';
import { UploadsApiService } from '../../api/uploads-api.service';

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.xml'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Ventana de las notas de crédito que el PROVEEDOR emite sobre un gasto del edificio: lista las registradas y, con el período en
// borrador, permite registrar una nueva con el documento que envió el proveedor (número, timbrado, fecha, monto, motivo y archivo).
@Component({
  standalone: true,
  selector: 'app-expense-credit-notes-dialog',
  imports: [CommonModule, FormsModule, Button, Tag],
  template: `
    <div class="ov-backdrop" (click)="close()">
      <div class="ov-panel" role="dialog" aria-modal="true" aria-label="Notas de crédito del proveedor" (click)="$event.stopPropagation()">
        <div class="ov-header">
          <div>
            <strong>Notas de crédito del proveedor</strong>
            <small>{{ expense.description }}<ng-container *ngIf="expense.supplierName"> · {{ expense.supplierName }}</ng-container></small>
          </div>
          <p-button type="button" icon="pi pi-times" severity="secondary" [rounded]="true" [text]="true" (onClick)="close()" aria-label="Cerrar"></p-button>
        </div>

        <!-- Resumen del gasto -->
        <div class="summary">
          <div><span>Facturado por el proveedor</span><strong>{{ gs(expense.originalAmount) }}</strong></div>
          <div class="minus"><span>(−) Notas de crédito aplicadas</span><strong>{{ gs(expense.creditedAmount) }}</strong></div>
          <div class="total"><span>Monto que se reparte</span><strong>{{ gs(expense.amount) }}</strong></div>
          <div class="credited" *ngIf="creditedSoFar > 0"><span>Acreditado como saldo a favor de las unidades</span><strong>{{ gs(creditedSoFar) }}</strong></div>
        </div>

        <div class="notice warn" *ngIf="recalculate">
          <i class="pi pi-exclamation-triangle"></i>
          <span>La liquidación de este período ya estaba calculada. Volvé a calcularla para que tome el nuevo monto del gasto.</span>
        </div>

        <!-- Registradas -->
        <p class="section-title">Registradas</p>
        <p class="muted" *ngIf="loading">Cargando...</p>
        <p class="muted" *ngIf="!loading && !notes.length">Este gasto no tiene notas de crédito.</p>

        <div class="note" *ngFor="let n of notes" [class.voided]="n.status === 'Voided'">
          <div class="note-main">
            <div class="note-head">
              <strong>NC {{ n.numero }}</strong>
              <p-tag *ngIf="n.status === 'Voided'" value="Anulada" severity="secondary"></p-tag>
              <p-tag *ngIf="n.mode === 'Credited' && n.status === 'Applied'" value="Saldo a favor" severity="success"></p-tag>
              <span class="note-amount">− {{ gs(n.amount) }}</span>
            </div>
            <small>
              {{ n.issueDate | date: 'dd/MM/yyyy' }}
              <ng-container *ngIf="n.timbrado"> · Timbrado {{ n.timbrado }}</ng-container>
              · {{ n.reason }}
            </small>
            <small *ngIf="n.status === 'Voided'" class="void-reason">Anulada: {{ n.voidReason }}</small>
            <a *ngIf="n.documentUrl" [href]="fileUrl(n.documentUrl)" target="_blank" rel="noopener" class="doc-link">
              <i class="pi" [ngClass]="isPdf(n.documentUrl) ? 'pi-file-pdf' : 'pi-paperclip'"></i> Ver documento del proveedor
            </a>
            <div class="alloc" *ngIf="n.allocations?.length">
              <span class="alloc-title">Acreditado como saldo a favor:</span>
              <span class="alloc-row" *ngFor="let a of n.allocations"><span>Unidad {{ a.unitCode }} · {{ a.ownerName }}</span><strong>{{ gs(a.amount) }}</strong></span>
            </div>
          </div>
          <div class="note-actions" *ngIf="n.status === 'Applied' && (isDraft || n.mode === 'Credited')">
            <p-button *ngIf="voidingId !== n.id" type="button" label="Anular" icon="pi pi-undo" size="small" severity="danger" [outlined]="true"
              (onClick)="startVoid(n)"></p-button>
          </div>
          <div class="void-box" *ngIf="voidingId === n.id">
            <input type="text" maxlength="500" placeholder="Motivo de la anulación (obligatorio)" [(ngModel)]="voidReason" name="voidReason" />
            <div class="void-actions">
              <p-button type="button" label="Volver" size="small" severity="secondary" [outlined]="true" [disabled]="saving" (onClick)="voidingId = null"></p-button>
              <p-button type="button" label="Confirmar anulación" size="small" severity="danger" [loading]="saving" [disabled]="!voidReason.trim()" (onClick)="confirmVoid(n)"></p-button>
            </div>
          </div>
        </div>

        <!-- Período cerrado o publicado -->
        <div class="notice" *ngIf="periodStatus === 'Closed'">
          <i class="pi pi-lock"></i>
          <span>El período está <strong>cerrado</strong>. Para registrar una nota de crédito, anulá primero la liquidación (Liquidación › Anular) y volvé a esta pantalla con el período en borrador.</span>
        </div>
        <div class="notice" *ngIf="isPublished">
          <i class="pi pi-info-circle"></i>
          <span>El período ya está <strong>publicado</strong>: no se tocan los comprobantes emitidos. La nota se reparte entre las unidades según lo que se les cobró de este gasto y cada parte se acredita como <strong>saldo a favor</strong> del propietario principal, que se aplica en su próximo pago.</span>
        </div>

        <!-- Formulario -->
        <ng-container *ngIf="isDraft || isPublished">
          <p class="section-title">Registrar una nota de crédito</p>
          <form class="form" (ngSubmit)="submit()" #ncForm="ngForm">
            <div class="row">
              <label class="field">
                <span>Número de la nota *</span>
                <input type="text" name="numero" maxlength="50" required placeholder="001-001-0000123" [(ngModel)]="form.numero" (ngModelChange)="error = ''" />
              </label>
              <label class="field">
                <span>Timbrado</span>
                <input type="text" name="timbrado" maxlength="20" placeholder="12345678" [(ngModel)]="form.timbrado" (ngModelChange)="error = ''" />
              </label>
            </div>
            <div class="row">
              <label class="field">
                <span>Fecha de emisión *</span>
                <input type="date" name="issueDate" required [max]="today" [(ngModel)]="form.issueDate" />
              </label>
              <label class="field">
                <span>Monto de la nota (₲) *</span>
                <input type="number" name="amount" required min="1" [max]="maxAmount" step="1" [(ngModel)]="form.amount" (ngModelChange)="onAmountChange()" />
                <small class="hint" *ngIf="isDraft">Máximo {{ gs(maxAmount) }} (el gasto debe quedar con monto).</small>
                <small class="hint" *ngIf="isPublished">Máximo {{ gs(maxAmount) }} (lo que todavía se puede acreditar de este gasto).</small>
              </label>
            </div>
            <label class="field">
              <span>Motivo *</span>
              <textarea name="reason" rows="2" maxlength="500" required placeholder="Por qué el proveedor emitió la nota (devolución, descuento, error de facturación...)" [(ngModel)]="form.reason"></textarea>
            </label>

            <div class="field">
              <span>Documento que envió el proveedor *</span>
              <div class="attach" *ngIf="!documentUrl">
                <label class="attach-btn" [class.disabled]="uploading">
                  <i class="pi" [ngClass]="uploading ? 'pi-spin pi-spinner' : 'pi-paperclip'"></i>
                  {{ uploading ? 'Subiendo...' : 'Adjuntar archivo' }}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xml" [disabled]="uploading" (change)="onFile($event)" />
                </label>
                <small class="hint">PDF, imagen (JPG, PNG, WEBP) o XML · máximo 10 MB</small>
              </div>
              <div class="attached" *ngIf="documentUrl">
                <a [href]="fileUrl(documentUrl)" target="_blank" rel="noopener"><i class="pi pi-file"></i> {{ documentName }}</a>
                <p-button type="button" icon="pi pi-times" severity="danger" [rounded]="true" [text]="true" size="small" aria-label="Quitar archivo" (onClick)="removeFile()"></p-button>
              </div>
            </div>

            <!-- Período publicado: reparto por unidad antes de confirmar -->
            <div class="preview" *ngIf="isPublished && preview">
              <p class="section-title">Reparto entre las unidades</p>
              <table class="preview-table" *ngIf="preview.rows.length">
                <thead><tr><th>Unidad</th><th>Propietario</th><th class="num">Cobrado</th><th class="num">Saldo a favor</th></tr></thead>
                <tbody>
                  <tr *ngFor="let r of preview.rows" [class.missing]="!r.ownerId">
                    <td>{{ r.unitCode }}</td>
                    <td>{{ r.ownerName || 'Sin propietario principal' }}</td>
                    <td class="num">{{ gs(r.chargeAmount) }}</td>
                    <td class="num"><strong>{{ gs(r.creditAmount) }}</strong></td>
                  </tr>
                </tbody>
                <tfoot><tr><td colspan="3">Total acreditado</td><td class="num"><strong>{{ gs(preview.amount) }}</strong></td></tr></tfoot>
              </table>
              <div class="notice warn" *ngIf="preview.message"><i class="pi pi-exclamation-triangle"></i><span>{{ preview.message }}</span></div>
            </div>

            <div class="notice error" *ngIf="error"><i class="pi pi-times-circle"></i><span>{{ error }}</span></div>

            <div class="actions">
              <p-button type="button" label="Cerrar" severity="secondary" [outlined]="true" (onClick)="close()"></p-button>
              <p-button *ngIf="isPublished && !preview" type="button" label="Ver reparto por unidad" icon="pi pi-list" [loading]="previewing" [disabled]="!canSubmit()" (onClick)="loadPreview()"></p-button>
              <p-button *ngIf="isPublished && preview" type="button" label="Cambiar datos" severity="secondary" [outlined]="true" (onClick)="preview = null"></p-button>
              <p-button *ngIf="isDraft || preview" type="submit" [label]="isPublished ? 'Confirmar y acreditar saldo a favor' : 'Registrar nota de crédito'" icon="pi pi-check" [loading]="saving" [disabled]="!canSubmit()"></p-button>
            </div>
          </form>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    .ov-backdrop { position: fixed; inset: 0; background: rgba(15, 33, 40, 0.5); z-index: 1100; display: flex; align-items: flex-start; justify-content: center; padding: 2rem 1rem; overflow-y: auto; }
    .ov-panel { background: var(--p-surface-0, #fff); border-radius: 14px; width: 100%; max-width: 640px; padding: 1.25rem 1.4rem 1.4rem; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
    .ov-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.9rem; }
    .ov-header strong { display: block; font-size: 1.05rem; }
    .ov-header small { color: var(--brand-muted, #64748b); }

    .summary { display: grid; gap: 0.35rem; padding: 0.75rem 0.9rem; background: var(--p-surface-50, #f8fafc); border: 1px solid var(--p-surface-200, #e2e8f0); border-radius: 10px; }
    .summary > div { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.9rem; }
    .summary .minus strong { color: #b45309; }
    .summary .total { border-top: 1px dashed var(--p-surface-300, #cbd5e1); padding-top: 0.4rem; font-size: 0.98rem; }
    .summary .credited strong { color: #15803d; }
    .alloc { display: grid; gap: 0.15rem; margin-top: 0.3rem; padding: 0.5rem 0.65rem; background: #f0fdf4; border-radius: 8px; font-size: 0.82rem; }
    .alloc-title { color: #166534; font-weight: 700; }
    .alloc-row { display: flex; justify-content: space-between; gap: 1rem; color: #14532d; }
    .preview-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .preview-table th, .preview-table td { padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--p-surface-200, #e2e8f0); text-align: left; }
    .preview-table .num { text-align: right; white-space: nowrap; }
    .preview-table tfoot td { border-bottom: none; font-weight: 700; padding-top: 0.6rem; }
    .preview-table tr.missing td { background: #fef2f2; color: #991b1b; }

    .section-title { margin: 1.1rem 0 0.5rem; font-weight: 700; font-size: 0.9rem; color: #29484f; }
    .muted { color: var(--brand-muted, #64748b); font-size: 0.88rem; margin: 0.2rem 0; }

    .notice { display: flex; gap: 0.6rem; align-items: flex-start; margin-top: 0.9rem; padding: 0.7rem 0.85rem; border-radius: 10px; background: #eff6ff; color: #1e3a8a; font-size: 0.88rem; }
    .notice.warn { background: #fffbeb; color: #92400e; }
    .notice.error { background: #fef2f2; color: #991b1b; }
    .notice i { margin-top: 0.15rem; }

    .note { display: grid; gap: 0.5rem; padding: 0.7rem 0.8rem; border: 1px solid var(--p-surface-200, #e2e8f0); border-radius: 10px; margin-bottom: 0.5rem; }
    .note.voided { opacity: 0.65; }
    .note-main { display: grid; gap: 0.2rem; }
    .note-head { display: flex; align-items: center; gap: 0.5rem; }
    .note-amount { margin-left: auto; font-weight: 700; color: #b45309; }
    .note small { color: var(--brand-muted, #64748b); }
    .void-reason { color: #991b1b !important; }
    .doc-link, .attached a { color: var(--p-primary-color); font-size: 0.85rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; }
    .doc-link:hover, .attached a:hover { text-decoration: underline; }
    .note-actions { display: flex; justify-content: flex-end; }
    .void-box { display: grid; gap: 0.5rem; }
    .void-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

    .form { display: grid; gap: 0.85rem; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; }
    @media (max-width: 560px) { .row { grid-template-columns: 1fr; } }
    .field { display: grid; gap: 0.35rem; }
    .field > span { font-weight: 700; color: #29484f; font-size: 0.85rem; }
    .field input[type="text"], .field input[type="number"], .field input[type="date"], .field textarea, .void-box input {
      width: 100%; padding: 0.55rem 0.7rem; border: 1.5px solid var(--p-surface-300, #cbd5e1); border-radius: 8px; font: inherit; background: var(--p-surface-0, #fff); color: inherit;
    }
    .field input:focus, .field textarea:focus, .void-box input:focus { outline: none; border-color: var(--p-primary-color); }
    .hint { color: var(--brand-muted, #64748b); font-size: 0.78rem; }

    .attach { display: grid; gap: 0.35rem; }
    .attach-btn { display: inline-flex; align-items: center; gap: 0.5rem; width: fit-content; padding: 0.55rem 1rem; border: 1.5px dashed var(--p-primary-color); color: var(--p-primary-color); border-radius: 8px; font-weight: 600; cursor: pointer; }
    .attach-btn.disabled { opacity: 0.6; cursor: wait; }
    .attach-btn input { display: none; }
    .attached { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.5rem 0.75rem; border: 1px solid var(--p-surface-200, #e2e8f0); border-radius: 8px; background: var(--p-surface-50, #f8fafc); }

    .actions { display: flex; justify-content: flex-end; gap: 0.6rem; padding-top: 0.25rem; }
  `]
})
export class BuildingExpenseCreditNotesDialogComponent implements OnInit {
  @Input({ required: true }) expense!: BuildingExpense;
  // Estado del período del gasto: solo en borrador se puede registrar o anular.
  @Input() periodStatus = 'Draft';
  @Output() closed = new EventEmitter<void>();
  // El gasto cambió (monto neto): la lista de gastos lo actualiza sin recargar.
  @Output() expenseChanged = new EventEmitter<BuildingExpense>();

  private readonly api = inject(BuildingExpensesApiService);
  private readonly uploads = inject(UploadsApiService);
  private readonly msg = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly fileUrl = resolveUploadUrl;
  readonly isPdf = isPdfUrl;
  readonly today = new Date().toISOString().slice(0, 10);

  notes: BuildingExpenseCreditNote[] = [];
  loading = true;
  saving = false;
  uploading = false;
  error = '';
  recalculate = false;

  documentUrl = '';
  documentName = '';
  voidingId: string | null = null;
  voidReason = '';
  form = this.emptyForm();

  previewing = false;
  preview: BuildingExpenseCreditNotePreview | null = null;

  get isDraft(): boolean { return this.periodStatus === 'Draft'; }
  get isPublished(): boolean { return this.periodStatus === 'Published'; }

  // Lo ya acreditado como saldo a favor de las unidades por notas de este gasto (período publicado).
  get creditedSoFar(): number {
    return this.notes.filter(n => n.status === 'Applied' && n.mode === 'Credited').reduce((sum, n) => sum + n.amount, 0);
  }

  // Borrador: el gasto tiene que seguir con monto positivo. Publicado: lo que todavía se puede acreditar del gasto.
  get maxAmount(): number {
    return this.isPublished
      ? Math.max(0, Math.floor(this.expense.amount - this.creditedSoFar))
      : Math.max(0, Math.floor(this.expense.amount) - 1);
  }

  ngOnInit(): void {
    this.api.getCreditNotes(this.expense.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: notes => { this.notes = notes; this.loading = false; this.cdr.markForCheck(); },
      error: err => { this.loading = false; this.error = extractApiErrorMessage(err, 'No se pudieron cargar las notas de crédito.'); this.cdr.markForCheck(); }
    });
  }

  close(): void { this.closed.emit(); }

  gs(value: number | null | undefined): string {
    return '₲ ' + new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  // Datos completos. En un período publicado, además, si ya se vio el reparto, todas las unidades deben tener propietario.
  canSubmit(): boolean {
    const f = this.form;
    const complete = !this.saving && !this.previewing && !this.uploading && !!f.numero.trim() && !!f.issueDate && !!f.reason.trim()
      && !!this.documentUrl && !!f.amount && f.amount > 0 && f.amount <= this.maxAmount;
    if (!complete) return false;
    return this.isPublished && this.preview ? this.preview.unitsWithoutOwner.length === 0 : true;
  }

  // El reparto mostrado corresponde a un monto: si cambia, hay que volver a verlo.
  onAmountChange(): void {
    this.preview = null;
    this.error = '';
  }

  loadPreview(): void {
    if (!this.canSubmit()) return;
    this.error = '';
    this.previewing = true;
    this.api.previewCreditNote(this.expense.id, Number(this.form.amount)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: preview => { this.preview = preview; this.previewing = false; this.cdr.markForCheck(); },
      error: err => {
        this.previewing = false;
        this.error = extractApiErrorMessage(err, 'No se pudo calcular el reparto.');
        this.cdr.markForCheck();
      }
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      this.error = 'El archivo debe ser PDF, imagen (JPG, PNG, WEBP) o XML.';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.error = 'El archivo supera el límite de 10 MB.';
      return;
    }

    this.error = '';
    this.uploading = true;
    this.uploads.upload(file).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ url }) => {
        this.documentUrl = url;
        this.documentName = file.name;
        this.uploading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.uploading = false;
        this.error = extractApiErrorMessage(err, 'No se pudo subir el archivo.');
        this.cdr.markForCheck();
      }
    });
  }

  removeFile(): void {
    this.documentUrl = '';
    this.documentName = '';
  }

  submit(): void {
    if (!this.canSubmit()) return;
    // Período publicado: primero se ve el reparto; recién con el reparto a la vista se confirma.
    if (this.isPublished && !this.preview) { this.loadPreview(); return; }
    this.error = '';
    this.saving = true;

    this.api.createCreditNote(this.expense.id, {
      numero: this.form.numero.trim(),
      timbrado: this.form.timbrado.trim() || null,
      issueDate: this.form.issueDate,
      amount: Number(this.form.amount),
      reason: this.form.reason.trim(),
      documentUrl: this.documentUrl
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.saving = false;
        this.notes = [result.creditNote, ...this.notes];
        this.applyExpense(result.expense);
        this.recalculate = result.settlementNeedsRecalculation;
        this.form = this.emptyForm();
        this.preview = null;
        this.removeFile();
        const detail = this.isPublished
          ? (result.creditedToOwners > 0
              ? `Se acreditaron ${this.gs(result.creditedToOwners)} como saldo a favor de las unidades.`
              : 'Registrada sin saldo a favor: el gasto no se cobró a las unidades.')
          : `El gasto quedó en ${this.gs(result.expense.amount)}.`;
        this.msg.add({ severity: 'success', summary: 'Nota de crédito registrada', detail, life: 6000 });
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        // Incluye el aviso de nota repetida (409): dice dónde ya está registrada.
        this.error = extractApiErrorMessage(err, 'No se pudo registrar la nota de crédito.');
        this.cdr.markForCheck();
      }
    });
  }

  startVoid(note: BuildingExpenseCreditNote): void {
    this.voidingId = note.id;
    this.voidReason = '';
  }

  confirmVoid(note: BuildingExpenseCreditNote): void {
    if (!this.voidReason.trim()) return;
    this.saving = true;
    this.api.voidCreditNote(note.id, this.voidReason.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.saving = false;
        this.voidingId = null;
        this.notes = this.notes.map(n => (n.id === note.id ? result.creditNote : n));
        this.applyExpense(result.expense);
        this.recalculate = result.settlementNeedsRecalculation;
        this.msg.add({
          severity: 'success', summary: 'Nota de crédito anulada', life: 5000,
          detail: result.creditNote.mode === 'Credited' ? 'Se devolvió el saldo a favor de las unidades.' : `El gasto volvió a ${this.gs(result.expense.amount)}.`
        });
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.error = extractApiErrorMessage(err, 'No se pudo anular la nota de crédito.');
        this.cdr.markForCheck();
      }
    });
  }

  private applyExpense(updated: BuildingExpense): void {
    this.expense = updated;
    this.expenseChanged.emit(updated);
  }

  private emptyForm() {
    return { numero: '', timbrado: '', issueDate: new Date().toISOString().slice(0, 10), amount: null as number | null, reason: '' };
  }
}
