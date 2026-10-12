import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { BuildingConfigOverview, ConfigAuditFilters, ConfigAuditPage } from './building-config.models';

// Centro de configuración del edificio. Un edificio ajeno responde 404 y un rol sin permiso, 403.
@Injectable({ providedIn: 'root' })
export class BuildingConfigApiService {
  private readonly http = inject(HttpClient);

  private url(buildingId: string, path: string): string {
    return `${API_BASE_URL}/building-config/${buildingId}/${path}`;
  }

  getOverview(buildingId: string): Observable<BuildingConfigOverview> {
    return this.http.get<BuildingConfigOverview>(this.url(buildingId, 'overview'));
  }

  getAudit(buildingId: string, filters: ConfigAuditFilters = {}): Observable<ConfigAuditPage> {
    let params = new HttpParams();
    if (filters.section) params = params.set('section', filters.section);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.page) params = params.set('page', filters.page);
    if (filters.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<ConfigAuditPage>(this.url(buildingId, 'audit'), { params });
  }
}
