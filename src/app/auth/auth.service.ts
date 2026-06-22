import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export type SessionUser = {
  userId: string;
  companyId: string | null;
  companyName: string | null;
  condominiumId: string | null;
  condominiumName: string | null;
  fullName: string;
  role: string;
  scopeLabel: string;
  mustChangePassword: boolean;
  avatar: string;
};

type SessionState = {
  token: string;
  expiresAtUtc: string;
  user: SessionUser;
};

type LoginResponse = {
  token: string;
  expiresAtUtc: string;
  userId: string;
  companyId: string | null;
  companyName: string | null;
  condominiumId: string | null;
  condominiumName: string | null;
  fullName: string;
  role: string;
  scopeLabel: string;
  mustChangePassword: boolean;
};

const SESSION_KEY = 'condopy-admin-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = signal<SessionState | null>(this.restoreSession());

  readonly currentUser = computed(() => this.session()?.user ?? null);

  login(email: string, password: string): Observable<boolean> {
    return this.http
      .post<LoginResponse>(`${API_BASE_URL}/auth/login`, {
        email: email.trim(),
        password
      })
      .pipe(
        tap((response) => {
          const session: SessionState = {
            token: response.token,
            expiresAtUtc: response.expiresAtUtc,
            user: {
              userId: response.userId,
              companyId: response.companyId,
              companyName: response.companyName,
              condominiumId: response.condominiumId,
              condominiumName: response.condominiumName,
              fullName: response.fullName,
              role: response.role,
              scopeLabel: response.scopeLabel,
              mustChangePassword: response.mustChangePassword,
              avatar: this.buildAvatar(response.fullName)
            }
          };

          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
          this.session.set(session);
        }),
        map((response) => response.mustChangePassword)
      );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http
      .post<void>(`${API_BASE_URL}/auth/change-password`, {
        currentPassword,
        newPassword
      })
      .pipe(
        tap(() => {
          const session = this.session();
          if (!session) {
            return;
          }

          this.session.set({
            ...session,
            user: {
              ...session.user,
              mustChangePassword: false
            }
          });

          localStorage.setItem(SESSION_KEY, JSON.stringify(this.session()));
        })
      );
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    this.session.set(null);
  }

  isAuthenticated(): boolean {
    const session = this.session();
    if (!session) {
      return false;
    }

    if (new Date(session.expiresAtUtc).getTime() <= Date.now()) {
      this.logout();
      return false;
    }

    return true;
  }

  getToken(): string | null {
    return this.isAuthenticated() ? this.session()?.token ?? null : null;
  }

  mustChangePassword(): boolean {
    return this.isAuthenticated() && Boolean(this.session()?.user.mustChangePassword);
  }

  hasRole(...roles: string[]): boolean {
    const currentRole = this.currentUser()?.role;
    return currentRole ? roles.includes(currentRole) : false;
  }

  private restoreSession(): SessionState | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }

    try {
      const session = JSON.parse(raw) as SessionState;
      if (!session.token || !session.expiresAtUtc || !session.user) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      if (new Date(session.expiresAtUtc).getTime() <= Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      return session;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  private buildAvatar(fullName: string): string {
    return fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
