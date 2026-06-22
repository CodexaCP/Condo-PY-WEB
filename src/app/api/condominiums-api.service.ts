import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Condominium, CreateCondominiumRequest } from './models';

@Injectable({ providedIn: 'root' })
export class CondominiumsApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Condominium[]> {
    return this.http.get<Condominium[]>(`${API_BASE_URL}/condominiums`);
  }

  getById(id: string): Observable<Condominium> {
    return this.http.get<Condominium>(`${API_BASE_URL}/condominiums/${id}`);
  }

  create(request: CreateCondominiumRequest): Observable<Condominium> {
    return this.http.post<Condominium>(`${API_BASE_URL}/condominiums`, request);
  }

  update(id: string, request: CreateCondominiumRequest): Observable<Condominium> {
    return this.http.put<Condominium>(`${API_BASE_URL}/condominiums/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/condominiums/${id}`);
  }
}
