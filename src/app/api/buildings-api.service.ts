import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Building, CreateBuildingRequest } from './models';

@Injectable({ providedIn: 'root' })
export class BuildingsApiService {
  private readonly http = inject(HttpClient);
  private cache$: Observable<Building[]> | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 30_000;

  getAll(): Observable<Building[]> {
    if (!this.cache$ || Date.now() > this.cacheExpiry) {
      this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
      this.cache$ = this.http.get<Building[]>(`${API_BASE_URL}/buildings`).pipe(shareReplay(1));
    }
    return this.cache$;
  }

  getById(id: string): Observable<Building> {
    return this.http.get<Building>(`${API_BASE_URL}/buildings/${id}`);
  }

  create(request: CreateBuildingRequest): Observable<Building> {
    return this.http.post<Building>(`${API_BASE_URL}/buildings`, request).pipe(tap(() => this.invalidateCache()));
  }

  update(id: string, request: CreateBuildingRequest): Observable<Building> {
    return this.http.put<Building>(`${API_BASE_URL}/buildings/${id}`, request).pipe(tap(() => this.invalidateCache()));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/buildings/${id}`).pipe(tap(() => this.invalidateCache()));
  }

  private invalidateCache(): void { this.cache$ = null; }
}
