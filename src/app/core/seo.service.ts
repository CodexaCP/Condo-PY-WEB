import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export const SITE_URL = 'https://expenses.com.py';

export interface SeoConfig {
  title: string;
  description: string;
  // Ruta de esta página (por ejemplo '/' o '/explorar'): arma la dirección canónica.
  path: string;
  // Páginas que no deben aparecer en Google (por ejemplo la 404).
  noindex?: boolean;
  // Datos estructurados (JSON-LD) de la página.
  jsonLd?: object[];
}

// Título, descripción, dirección canónica, redes sociales y datos estructurados por página. Funciona igual en el navegador
// y al prerenderizar en el servidor, donde queda escrito en el HTML que recibe Google.
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  set(config: SeoConfig): void {
    const url = SITE_URL + (config.path === '/' ? '/' : config.path);

    this.title.setTitle(config.title);
    this.meta.updateTag({ name: 'description', content: config.description });
    this.meta.updateTag({ name: 'robots', content: config.noindex ? 'noindex, follow' : 'index, follow' });

    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'Expenses' });
    this.meta.updateTag({ property: 'og:locale', content: 'es_PY' });
    this.meta.updateTag({ property: 'og:title', content: config.title });
    this.meta.updateTag({ property: 'og:description', content: config.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: config.title });
    this.meta.updateTag({ name: 'twitter:description', content: config.description });

    this.setCanonical(url);
    this.setJsonLd(config.jsonLd ?? []);
  }

  private setCanonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(items: object[]): void {
    this.doc.head.querySelectorAll('script[data-seo-jsonld]').forEach((el) => el.remove());
    for (const item of items) {
      const script = this.doc.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute('data-seo-jsonld', '');
      script.textContent = JSON.stringify(item);
      this.doc.head.appendChild(script);
    }
  }
}
