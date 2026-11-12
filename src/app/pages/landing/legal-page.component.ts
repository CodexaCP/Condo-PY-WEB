import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo.service';

interface LegalSection {
  title: string;
  paragraphs: string[];
}

interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

// BORRADOR: textos base para que los revise un abogado antes de publicarlos como definitivos.
// Los datos que dependen de la empresa quedan marcados como [COMPLETAR: ...]; ningún texto aquí cita leyes concretas.
// Se redactaron solo con lo que hace hoy la página de inicio: formulario de contacto de Hostinger Reach, estadísticas de
// Google Analytics, botones a WhatsApp, demostración con datos ficticios y tipografías de terceros.
const PRIVACY: LegalDoc = {
  title: 'Política de privacidad',
  intro: 'Esta política explica qué datos recoge el sitio expenses.com.py (la página pública de Expenses), para qué se usan y cómo puedes pedir su corrección o eliminación. No describe el tratamiento de datos dentro del sistema contratado por cada edificio, que se rige por su propio contrato.',
  sections: [
    {
      title: 'Quién es el responsable',
      paragraphs: ['Expenses [COMPLETAR: razón social, RUC y domicilio]. Puedes contactarnos por el WhatsApp comercial indicado en el sitio [COMPLETAR: correo de contacto para temas de privacidad].']
    },
    {
      title: 'Qué datos recogemos',
      paragraphs: [
        'Formulario de contacto: nombre, correo electrónico y número de teléfono que escribes voluntariamente. El formulario lo opera Hostinger Reach.',
        'Estadísticas de uso: datos técnicos y de navegación (por ejemplo páginas vistas, clics en «Probar demo» o en los botones de WhatsApp, tipo de dispositivo) mediante Google Analytics.',
        'WhatsApp: si pulsas un botón de WhatsApp, se abre una conversación con nuestro número comercial y el mensaje que envíes queda en esa conversación.',
        'Demostración: la demostración usa un edificio ficticio, no pide registro y no recoge datos personales tuyos.'
      ]
    },
    {
      title: 'Para qué usamos los datos',
      paragraphs: [
        'Responder tus consultas y enviarte la propuesta o cotización que pidas.',
        'Enviarte comunicaciones y promociones, solo si marcaste la casilla correspondiente del formulario. Puedes retirar ese permiso en cualquier momento.',
        'Medir y mejorar el sitio.'
      ]
    },
    {
      title: 'Con quién los compartimos',
      paragraphs: ['Con los proveedores que hacen funcionar el sitio: Hostinger (formulario y alojamiento), Google (estadísticas y tipografías), Meta/WhatsApp (conversaciones) y otros proveedores de tipografías. No vendemos tus datos. [COMPLETAR: confirmar la lista completa de proveedores].']
    },
    {
      title: 'Cuánto tiempo los conservamos',
      paragraphs: ['[COMPLETAR: plazo de conservación de los datos de contacto].']
    },
    {
      title: 'Tus derechos',
      paragraphs: ['Puedes pedir acceso, corrección o eliminación de tus datos, y retirar tu permiso para recibir comunicaciones, escribiéndonos por el canal de contacto indicado arriba. [COMPLETAR: plazo de respuesta].']
    },
    {
      title: 'Cookies y tecnologías similares',
      paragraphs: ['El sitio usa Google Analytics, que puede instalar cookies para medir el uso. Puedes bloquearlas desde la configuración de tu navegador. [COMPLETAR: definir si se añadirá un aviso de cookies].']
    },
    {
      title: 'Cambios en esta política',
      paragraphs: ['Podemos actualizar esta política. La versión vigente es la publicada en esta página. [COMPLETAR: fecha de última actualización].']
    }
  ]
};

const TERMS: LegalDoc = {
  title: 'Términos de uso del sitio',
  intro: 'Estos términos regulan el uso del sitio expenses.com.py, la página pública de Expenses. El uso del sistema por un edificio contratado se rige por el contrato o la propuesta aceptada por cada cliente.',
  sections: [
    {
      title: 'Objeto del sitio',
      paragraphs: ['El sitio presenta información sobre Expenses, un software para administrar edificios y condominios, y permite probar una demostración y pedir una cotización.']
    },
    {
      title: 'Información y vistas de ejemplo',
      paragraphs: ['Los textos, cifras e imágenes del sitio son informativos. Las vistas marcadas como «Vista de ejemplo» son ilustrativas y no representan datos reales de ningún edificio. Las funciones y los módulos pueden cambiar o variar según el plan contratado.']
    },
    {
      title: 'Demostración gratuita',
      paragraphs: ['La demostración usa un edificio ficticio y datos de ejemplo. No genera obligaciones ni compromiso de contratación.']
    },
    {
      title: 'Cotizaciones y contratación',
      paragraphs: ['Una cotización o propuesta no constituye un contrato hasta que sea aceptada por ambas partes [COMPLETAR: forma de aceptación]. Las condiciones del servicio, precios y períodos de prueba se establecen en la propuesta o el contrato.']
    },
    {
      title: 'Propiedad intelectual',
      paragraphs: ['La marca, el software, los textos y el diseño del sitio pertenecen a [COMPLETAR: titular] o se usan con autorización. No se permite copiarlos ni reutilizarlos sin permiso.']
    },
    {
      title: 'Enlaces y servicios de terceros',
      paragraphs: ['El sitio enlaza a servicios de terceros (por ejemplo WhatsApp y LinkedIn) y los usa para funcionar. No somos responsables de sus contenidos ni de sus políticas.']
    },
    {
      title: 'Responsabilidad',
      paragraphs: ['Hacemos lo posible por mantener el sitio disponible y la información actualizada, pero no garantizamos que esté libre de interrupciones o errores. [COMPLETAR: alcance de la limitación de responsabilidad, a revisar por un abogado].']
    },
    {
      title: 'Ley aplicable',
      paragraphs: ['Estos términos se interpretan según las leyes de la República del Paraguay. [COMPLETAR: jurisdicción y tribunales competentes].']
    }
  ]
};

// Páginas legales públicas: /privacidad y /terminos (data: { doc: 'privacy' | 'terms' }). Solo en español por ahora.
@Component({
  standalone: true,
  selector: 'app-legal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header class="top">
      <a routerLink="/" class="back">← Volver al inicio</a>
    </header>
    <main id="contenido" class="doc">
      <p class="draft" role="note"><b>Borrador.</b> Texto base pendiente de revisión legal; los datos marcados como [COMPLETAR] faltan. No es asesoramiento legal.</p>
      <h1>{{ doc.title }}</h1>
      <p class="intro">{{ doc.intro }}</p>
      @for (s of doc.sections; track s.title) {
        <section>
          <h2>{{ s.title }}</h2>
          @for (p of s.paragraphs; track p) { <p>{{ p }}</p> }
        </section>
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; min-height: 100vh; background: #fff; color: #16324a; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; line-height: 1.6; }
      .top { max-width: 46rem; margin: 0 auto; padding: 1rem 1.5rem 0; }
      .back { display: inline-flex; align-items: center; min-height: 2.75rem; color: #0f6f9a; font-weight: 700; text-decoration: none; }
      .back:hover { text-decoration: underline; }
      .doc { max-width: 46rem; margin: 0 auto; padding: 0.5rem 1.5rem 4rem; }
      .draft { background: #fff7e0; border: 1px solid #e8c766; border-radius: 0.7rem; padding: 0.7rem 1rem; font-size: 0.9rem; color: #5a4300; }
      h1 { font-size: clamp(1.7rem, 4vw, 2.3rem); font-weight: 800; color: #11364a; margin: 1.2rem 0 0.8rem; line-height: 1.2; }
      h2 { font-size: 1.15rem; color: #11364a; margin: 1.8rem 0 0.4rem; }
      p { margin: 0.5rem 0; color: #3b5463; }
      .intro { font-size: 1.05rem; }
    `
  ]
})
export class LegalPageComponent {
  readonly doc: LegalDoc = inject(ActivatedRoute).snapshot.data['doc'] === 'terms' ? TERMS : PRIVACY;

  constructor() {
    const isTerms = this.doc === TERMS;
    inject(SeoService).set({
      title: `${this.doc.title} | Expenses`,
      description: isTerms ? 'Términos de uso del sitio de Expenses.' : 'Política de privacidad del sitio de Expenses.',
      path: isTerms ? '/terminos' : '/privacidad',
      // Es un borrador: no debe aparecer en Google hasta que lo apruebe el área legal.
      noindex: true
    });
  }
}
