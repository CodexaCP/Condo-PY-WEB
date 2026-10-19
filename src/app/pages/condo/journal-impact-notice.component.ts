import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, OnChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { AccountingApiService } from '../../api/accounting-api.service';
import { JournalImpact } from '../../api/building-config.models';

// Aviso previo a revertir un pago o deshacer la publicación de un período: si lo que se está por cambiar ya está asentado en el Libro diario,
// lo dice (con los números de asiento) y explica que el asiento no se modifica: se corrige con un contraasiento al volver a asentar.
// No muestra nada si no hay asientos, si el edificio no usa Finanzas o si falla la consulta (es solo informativo).
@Component({
  standalone: true,
  selector: 'app-journal-impact-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="impact" *ngIf="impact?.posted as posted" role="note">
      <strong>{{ headline }}</strong>
      ({{ impact!.postedCount === 1 ? 'asiento' : 'asientos' }} {{ impact!.labels.join(', ') }}{{ impact!.postedCount > impact!.labels.length ? ' y otros' : '' }}).
      Los asientos no se modifican: al volver a asentar el Libro diario se va a generar un contraasiento y, si corresponde, un asiento nuevo
      con la corrección. {{ closing }}
    </div>
  `,
  styles: [`
    .impact { margin: 0.6rem 0; padding: 0.65rem 0.85rem; border-radius: 10px; font-size: 0.88rem; border: 1px solid #e0a23b; background: rgba(224,162,59,0.1); color: var(--brand-ink); }
  `]
})
export class JournalImpactNoticeComponent implements OnChanges {
  private readonly api = inject(AccountingApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() kind: 'payment' | 'period' | 'expense' = 'payment';
  @Input() ownerPaymentId = '';
  @Input() periodId = '';
  @Input() expenseId = '';

  impact: JournalImpact | null = null;

  get headline(): string {
    return this.kind === 'period' ? 'Este período tiene movimientos ya asentados en el Libro diario'
      : (this.kind === 'payment' ? 'Este pago' : 'Este gasto') + ' ya está asentado en el Libro diario';
  }

  get closing(): string {
    return this.kind === 'period' ? 'Si el período se vuelve a publicar con cambios, esos cambios también se corrigen así.' : '';
  }

  ngOnChanges(): void {
    const source = this.kind === 'payment' ? { ownerPaymentId: this.ownerPaymentId }
      : this.kind === 'period' ? { periodId: this.periodId } : { expenseId: this.expenseId };
    if (!Object.values(source)[0]) {
      this.impact = null;
      return;
    }

    this.api.getJournalImpact(source).pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef)).subscribe(impact => {
      this.impact = impact;
      this.cdr.markForCheck();
    });
  }
}
