import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Company, CreateCompanyRequest } from './models';

@Injectable({ providedIn: 'root' })
export class CompaniesApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Company[]> {
    return this.http.get<Company[]>(`${API_BASE_URL}/companies`);
  }

  getById(id: string): Observable<Company> {
    return this.http.get<Company>(`${API_BASE_URL}/companies/${id}`);
  }

  create(request: CreateCompanyRequest): Observable<Company> {
    return this.http.post<Company>(`${API_BASE_URL}/companies`, request);
  }

  update(id: string, request: CreateCompanyRequest): Observable<Company> {
    return this.http.put<Company>(`${API_BASE_URL}/companies/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/companies/${id}`);
  }
}
