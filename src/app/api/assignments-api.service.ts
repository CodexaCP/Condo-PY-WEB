import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Assignment, CreateAssignmentRequest } from './models';

@Injectable({ providedIn: 'root' })
export class AssignmentsApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Assignment[]> {
    return this.http.get<Assignment[]>(`${API_BASE_URL}/unit-residents`);
  }

  create(request: CreateAssignmentRequest): Observable<Assignment> {
    return this.http.post<Assignment>(`${API_BASE_URL}/unit-residents`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/unit-residents/${id}`);
  }
}
