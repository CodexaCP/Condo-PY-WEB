import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { MarketplaceApiService } from './marketplace-api.service';
import { MarketplaceStaffBuilding } from './models';

// Qué edificios del usuario tienen el Marketplace disponible (habilitado por el SuperAdmin y con un plan que lo incluye) y qué
// puede hacer su rol en cada uno. El menú muestra «Pagos» y «Cuenta» solo si hay al menos un edificio donde corresponda:
// con el módulo apagado, o con un rol sin ese permiso, no aparece nada.
@Injectable({ providedIn: 'root' })
export class MarketplaceAccessService {
  private readonly api = inject(MarketplaceApiService);
  private readonly auth = inject(AuthService);

  readonly buildings = signal<MarketplaceStaffBuilding[]>([]);
  readonly canReviewPayments = computed(() => this.buildings().some(b => b.canReviewPayments));
  readonly canViewAccount = computed(() => this.buildings().some(b => b.canViewAccount));

  refresh(): void {
    if (!this.auth.hasRole('SuperAdmin', 'CompanyAdmin', 'CompanyOperator', 'BuildingManager')) {
      this.buildings.set([]);
      return;
    }

    this.api.getStaffBuildings().subscribe({
      next: buildings => this.buildings.set(buildings),
      error: () => this.buildings.set([])
    });
  }
}
