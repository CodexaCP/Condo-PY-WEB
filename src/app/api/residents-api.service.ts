import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreateResidentRequest, Resident } from './models';

@Injectable({ providedIn: 'root' })
export class ResidentsApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Resident[]> {
    return this.http.get<Resident[]>(`${API_BASE_URL}/residents`);
  }

  create(request: CreateResidentRequest): Observable<Resident> {
    return this.http.post<Resident>(`${API_BASE_URL}/residents`, request);
  }

  update(id: string, request: CreateResidentRequest): Observable<Resident> {
    return this.http.put<Resident>(`${API_BASE_URL}/residents/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/residents/${id}`);
  }
}
