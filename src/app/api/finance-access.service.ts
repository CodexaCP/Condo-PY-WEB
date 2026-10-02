import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { FinanceApiService } from './finance-api.service';
import { FinanceBuildingAccess } from './models';

// Qué edificios del usuario tienen el módulo «Finanzas del edificio» disponible (habilitado por el SuperAdmin y con un plan
// que lo incluye). El menú muestra el grupo solo si hay al menos uno: con el módulo apagado no aparece nada.
@Injectable({ providedIn: 'root' })
export class FinanceAccessService {
  private readonly api = inject(FinanceApiService);
  private readonly auth = inject(AuthService);

  readonly buildings = signal<FinanceBuildingAccess[]>([]);
  readonly available = computed(() => this.buildings().length > 0);

  // El SuperAdmin habilita el módulo y lo configura desde «Finanzas por edificio» (servicio de configuración), y además ve las pantallas
  // del módulo de los edificios habilitados; el resto de los roles administrativos lo usan desde el menú.
  refresh(): void {
    if (!this.auth.hasRole('SuperAdmin', 'CompanyAdmin', 'CompanyOperator', 'BuildingManager')) {
      this.buildings.set([]);
      return;
    }

    this.api.getBuildings().subscribe({
      next: buildings => this.buildings.set(buildings),
      error: () => this.buildings.set([])
    });
  }
}
