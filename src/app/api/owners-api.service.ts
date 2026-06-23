import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Owner, OwnerUpsertRequest } from './models';

@Injectable({ providedIn: 'root' })
export class OwnersApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Owner[]> {
    return this.http.get<Owner[]>(`${API_BASE_URL}/owners`);
  }

  getById(id: string): Observable<Owner> {
    return this.http.get<Owner>(`${API_BASE_URL}/owners/${id}`);
  }

  create(request: OwnerUpsertRequest): Observable<Owner> {
    return this.http.post<Owner>(`${API_BASE_URL}/owners`, request);
  }

  update(id: string, request: OwnerUpsertRequest): Observable<Owner> {
    return this.http.put<Owner>(`${API_BASE_URL}/owners/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/owners/${id}`);
  }
}
