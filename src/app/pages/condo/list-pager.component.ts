import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

// Pie de los listados paginados en el servidor: "Mostrando X–Y de N", filas por página y navegación.
@Component({
  standalone: true,
  selector: 'app-list-pager',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pager" *ngIf="totalCount > 0">
      <span class="pager-info">Mostrando {{ rangeFrom }}–{{ rangeTo }} de {{ totalCount }}</span>
      <div class="pager-controls">
        <label class="pager-size">Filas
          <select [value]="pageSize" (change)="onSize($any($event.target).value)">
            <option *ngFor="let s of sizes" [value]="s" [selected]="s === pageSize">{{ s }}</option>
          </select>
        </label>
        <button type="button" class="pg-btn" [disabled]="page <= 1" (click)="go(page - 1)" aria-label="Página anterior">‹</button>
        <ng-container *ngIf="pageNumbers[0] > 1">
          <button type="button" class="pg-btn" (click)="go(1)">1</button>
          <span class="pg-gap" *ngIf="pageNumbers[0] > 2">…</span>
        </ng-container>
        <button type="button" class="pg-btn" *ngFor="let p of pageNumbers" [class.pg-active]="p === page" (click)="go(p)">{{ p }}</button>
        <ng-container *ngIf="pageNumbers[pageNumbers.length - 1] < totalPages">
          <span class="pg-gap" *ngIf="pageNumbers[pageNumbers.length - 1] < totalPages - 1">…</span>
          <button type="button" class="pg-btn" (click)="go(totalPages)">{{ totalPages }}</button>
        </ng-container>
        <button type="button" class="pg-btn" [disabled]="page >= totalPages" (click)="go(page + 1)" aria-label="Página siguiente">›</button>
      </div>
    </div>
  `,
  styles: [`
    .pager { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.9rem; }
    .pager-info { color: var(--brand-muted); font-size: 0.85rem; }
    .pager-controls { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
    .pager-size { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: var(--brand-muted); margin-right: 0.6rem; }
    .pager-size select { border: 1.5px solid rgba(20,54,61,0.18); border-radius: 8px; padding: 0.25rem 0.4rem; background: #fff; }
    .pg-btn { min-width: 34px; height: 34px; border-radius: 9px; border: 1px solid rgba(20,54,61,0.15); background: #fff; color: var(--brand-ink); cursor: pointer; font-weight: 600; }
    .pg-btn:hover:not([disabled]) { background: rgba(19,133,182,0.08); }
    .pg-btn[disabled] { opacity: 0.4; cursor: default; }
    .pg-active { background: var(--brand-blue); color: #fff; border-color: var(--brand-blue); }
    .pg-gap { color: var(--brand-muted); padding: 0 0.1rem; }
  `]
})
export class ListPagerComponent {
  @Input() page = 1;
  @Input() pageSize = 25;
  @Input() totalCount = 0;
  @Input() sizes: number[] = [25, 50, 100];
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get totalPages(): number { return Math.max(Math.ceil(this.totalCount / this.pageSize), 1); }
  get rangeFrom(): number { return this.totalCount > 0 ? (this.page - 1) * this.pageSize + 1 : 0; }
  get rangeTo(): number { return Math.min(this.page * this.pageSize, this.totalCount); }

  // Cinco páginas alrededor de la actual; la primera y la última van aparte con "…".
  get pageNumbers(): number[] {
    const total = this.totalPages;
    const start = Math.max(1, Math.min(this.page - 2, total - 4));
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  go(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.page) return;
    this.pageChange.emit(p);
  }

  onSize(value: string): void {
    const size = Number(value);
    if (size > 0 && size !== this.pageSize) this.pageSizeChange.emit(size);
  }
}
