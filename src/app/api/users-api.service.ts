import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { BuildingCapacityResponse, CreateUserRequest, ManagedUser } from './models';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(`${API_BASE_URL}/users`);
  }

  getById(id: string): Observable<ManagedUser> {
    return this.http.get<ManagedUser>(`${API_BASE_URL}/users/${id}`);
  }

  create(request: CreateUserRequest): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(`${API_BASE_URL}/users`, request);
  }

  update(id: string, request: CreateUserRequest): Observable<ManagedUser> {
    return this.http.put<ManagedUser>(`${API_BASE_URL}/users/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/users/${id}`);
  }

  getCapacity(): Observable<BuildingCapacityResponse> {
    return this.http.get<BuildingCapacityResponse>(`${API_BASE_URL}/users/capacity`);
  }
}
