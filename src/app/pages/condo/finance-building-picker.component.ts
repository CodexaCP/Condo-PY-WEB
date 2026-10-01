import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FinanceApiService } from '../../api/finance-api.service';
import { FinanceBuildingAccess } from '../../api/models';

const STORAGE_KEY = 'condopy.finance.buildingId';

// Selector del edificio para las pantallas de Finanzas: lista solo los edificios del usuario con el modulo disponible. Con un
// solo edificio muestra su nombre; con varios, un desplegable. Parte del edificio pedido en la URL (?buildingId=), del ultimo
// que se uso en el navegador o del primero de la lista, y avisa con `selected` (nulo si no hay ninguno disponible).
@Component({
  standalone: true,
  selector: 'app-finance-building-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <label class="picker" *ngIf="buildings.length > 1">
      <span>Edificio</span>
      <select [ngModel]="selectedId" (ngModelChange)="choose($event)">
        <option *ngFor="let b of buildings" [value]="b.buildingId">{{ b.buildingName }}</option>
      </select>
    </label>
    <strong class="single" *ngIf="buildings.length === 1">{{ buildings[0].buildingName }}</strong>
  `,
  styles: [`
    :host { display: inline-block; }
    .picker { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .picker select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc);
    }
    .single { font-size: 1.05rem; color: var(--brand-ink); }
  `]
})
export class FinanceBuildingPickerComponent implements OnInit {
  private readonly api = inject(FinanceApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Output() selected = new EventEmitter<FinanceBuildingAccess | null>();
  // Error al cargar la lista de edificios (por ejemplo, plan bloqueado).
  @Output() failed = new EventEmitter<unknown>();

  buildings: FinanceBuildingAccess[] = [];
  selectedId = '';

  ngOnInit(): void {
    const requested = this.route.snapshot.queryParamMap.get('buildingId') ?? this.remembered();

    this.api.getBuildings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: buildings => {
        this.buildings = buildings;
        const current = buildings.find(b => b.buildingId === requested) ?? buildings[0] ?? null;
        this.selectedId = current?.buildingId ?? '';
        this.selected.emit(current);
        this.cdr.markForCheck();
      },
      error: err => {
        this.failed.emit(err);
        this.cdr.markForCheck();
      }
    });
  }

  choose(id: string): void {
    const building = this.buildings.find(b => b.buildingId === id);
    if (!building || id === this.selectedId) return;

    this.selectedId = id;
    this.remember(id);
    void this.router.navigate([], { queryParams: { buildingId: id }, queryParamsHandling: 'merge', replaceUrl: true });
    this.selected.emit(building);
  }

  private remembered(): string | null {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  private remember(id: string): void {
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* sin almacenamiento: no se recuerda */ }
  }
}
