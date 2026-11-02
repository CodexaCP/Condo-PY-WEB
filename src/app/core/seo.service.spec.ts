import { DOCUMENT } from '@angular/common';
import { Injector } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SeoService } from './seo.service';

// Documento mínimo en memoria: solo lo que usa SeoService (head, querySelector[All], createElement, appendChild y el atributo lang del <html>).
class FakeEl {
  attrs: Record<string, string> = {};
  textContent = '';
  constructor(public tag: string, private readonly head?: FakeHead) {}
  setAttribute(k: string, v: string): void { this.attrs[k] = v; }
  remove(): void { this.head?.children.splice(this.head.children.indexOf(this), 1); }
}
class FakeHead {
  children: FakeEl[] = [];
  private matches(el: FakeEl, selector: string): boolean {
    if (selector === 'link[rel="canonical"]') return el.tag === 'link' && el.attrs['rel'] === 'canonical';
    if (selector === 'link[rel="alternate"][hreflang]') return el.tag === 'link' && el.attrs['rel'] === 'alternate' && 'hreflang' in el.attrs;
    if (selector === 'script[data-seo-jsonld]') return el.tag === 'script' && 'data-seo-jsonld' in el.attrs;
    return false;
  }
  querySelector<T>(selector: string): T | null { return (this.children.find((c) => this.matches(c, selector)) as unknown as T) ?? null; }
  querySelectorAll(selector: string): FakeEl[] { return this.children.filter((c) => this.matches(c, selector)); }
  appendChild(el: FakeEl): void { this.children.push(el); }
}

describe('SeoService', () => {
  let seo: SeoService;
  let head: FakeHead;
  let tags: Record<string, string>;
  let htmlLang: string;

  beforeEach(() => {
    head = new FakeHead();
    tags = {};
    htmlLang = '';
    const doc = {
      head,
      documentElement: { setAttribute: (_k: string, v: string) => (htmlLang = v) },
      createElement: (tag: string) => new FakeEl(tag, head)
    };
    const meta = { updateTag: (t: { name?: string; property?: string; content: string }) => (tags[t.name ?? t.property ?? ''] = t.content) };
    const injector = Injector.create({
      providers: [
        { provide: DOCUMENT, useValue: doc },
        { provide: Meta, useValue: meta },
        { provide: Title, useValue: { setTitle: () => undefined } },
        { provide: SeoService, useClass: SeoService, deps: [] }
      ]
    });
    seo = injector.get(SeoService);
  });

  const canonical = (): string | undefined => head.children.find((c) => c.attrs['rel'] === 'canonical')?.attrs['href'];

  it('página indexable: robots index y canonical propio', () => {
    seo.set({ title: 'T', description: 'D', path: '/' });

    expect(tags['robots']).toBe('index, follow');
    expect(canonical()).toBe('https://expenses.com.py/');
  });

  it('página noindex: robots noindex y sin canonical', () => {
    seo.set({ title: 'T', description: 'D', path: '/login', noindex: true });

    expect(tags['robots']).toBe('noindex, follow');
    expect(canonical()).toBeUndefined();
  });

  it('al pasar de una página indexable a una noindex se quita el canonical anterior', () => {
    seo.set({ title: 'T', description: 'D', path: '/' });
    seo.set({ title: 'L', description: 'D', path: '/login', noindex: true });

    expect(canonical()).toBeUndefined();
  });

  it('al volver a una página indexable se restituye robots y canonical', () => {
    seo.set({ title: 'L', description: 'D', path: '/login', noindex: true });
    seo.set({ title: 'T', description: 'D', path: '/pt/', lang: 'pt' });

    expect(tags['robots']).toBe('index, follow');
    expect(canonical()).toBe('https://expenses.com.py/pt/');
    expect(htmlLang).toBe('pt');
  });

  it('markNoindex marca noindex, quita el canonical y no toca el idioma ni el título', () => {
    seo.set({ title: 'T', description: 'D', path: '/', lang: 'en' });

    seo.markNoindex();

    expect(tags['robots']).toBe('noindex, follow');
    expect(canonical()).toBeUndefined();
    expect(htmlLang).toBe('en');
  });
});
