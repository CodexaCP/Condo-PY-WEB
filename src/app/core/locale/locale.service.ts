import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import { AuthService } from '../../auth/auth.service';
import { CompanyLocale, CountryProfile } from './locale.models';
import { currentLocale } from './locale.state';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly locale = currentLocale;

  // Catalogo de paises con sus valores iniciales (moneda, impuesto, zona horaria, tipos de documento). Lo usa el alta de la empresa.
  countries(): Observable<CountryProfile[]> {
    return this.http.get<CountryProfile[]>(`${API_BASE_URL}/locale/countries`);
  }

  // Vuelve a pedir la configuracion regional de la empresa del usuario (por ejemplo despues de editar la empresa) y la guarda en la sesion.
  refresh(): Observable<CompanyLocale> {
    return this.http.get<CompanyLocale>(`${API_BASE_URL}/locale/me`).pipe(tap((locale) => this.auth.setLocale(locale)));
  }
}
