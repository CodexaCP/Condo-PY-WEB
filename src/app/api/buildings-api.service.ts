import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Building, CreateBuildingRequest } from './models';

@Injectable({ providedIn: 'root' })
export class BuildingsApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Building[]> {
    return this.http.get<Building[]>(`${API_BASE_URL}/buildings`);
  }

  getById(id: string): Observable<Building> {
    return this.http.get<Building>(`${API_BASE_URL}/buildings/${id}`);
  }

  create(request: CreateBuildingRequest): Observable<Building> {
    return this.http.post<Building>(`${API_BASE_URL}/buildings`, request);
  }

  update(id: string, request: CreateBuildingRequest): Observable<Building> {
    return this.http.put<Building>(`${API_BASE_URL}/buildings/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/buildings/${id}`);
  }
}
