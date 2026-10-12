import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BuildingsApiService } from '../../api/buildings-api.service';
import { Building } from '../../api/models';

const STORAGE_KEY = 'condopy.config.buildingId';

// Selector del edificio del Centro de configuración: lista todos los edificios del usuario (con o sin Finanzas). Parte del edificio pedido
// en la URL (?buildingId=), del último que se usó en el navegador o del primero de la lista, y avisa con `selected` (nulo si no hay ninguno).
@Component({
  standalone: true,
  selector: 'app-config-building-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <label class="picker" *ngIf="buildings.length > 1">
      <span>Edificio</span>
      <select [ngModel]="selectedId" (ngModelChange)="choose($event)">
        <option *ngFor="let b of buildings" [value]="b.id">{{ b.name }}</option>
      </select>
    </label>
    <strong class="single" *ngIf="buildings.length === 1">{{ buildings[0].name }}</strong>
  `,
  styles: [`
    :host { display: inline-block; }
    .picker { display: grid; gap: 0.25rem; font-size: 0.82rem; font-weight: 600; color: var(--brand-muted); }
    .picker select {
      padding: 0.5rem 0.75rem; border: 1px solid rgba(19,133,182,0.25); border-radius: 10px;
      font: inherit; font-size: 0.95rem; color: var(--brand-ink); background: var(--surface-ground, #f8fafc); min-width: 14rem;
    }
    .single { font-size: 1.05rem; color: var(--brand-ink); }
  `]
})
export class ConfigBuildingPickerComponent implements OnInit {
  private readonly api = inject(BuildingsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  @Output() selected = new EventEmitter<Building | null>();
  // Error al cargar la lista de edificios.
  @Output() failed = new EventEmitter<unknown>();

  buildings: Building[] = [];
  selectedId = '';

  ngOnInit(): void {
    const requested = this.route.snapshot.queryParamMap.get('buildingId') ?? this.remembered();

    this.api.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: all => {
        this.buildings = all.filter(b => b.isActive).sort((a, b) => a.name.localeCompare(b.name));
        const current = this.buildings.find(b => b.id === requested) ?? this.buildings[0] ?? null;
        this.selectedId = current?.id ?? '';
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
    const building = this.buildings.find(b => b.id === id);
    if (!building || id === this.selectedId) return;

    this.selectedId = id;
    this.remember(id);
    // Al cambiar de edificio se sale de la sección abierta: cada edificio tiene la suya.
    void this.router.navigate([], { queryParams: { buildingId: id, section: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.selected.emit(building);
  }

  private remembered(): string | null {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  }

  private remember(id: string): void {
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* sin almacenamiento: no se recuerda */ }
  }
}
