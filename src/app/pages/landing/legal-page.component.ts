import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo.service';

// Un bloque de una sección: párrafo, subtítulo o lista.
type LegalBlock = { kind: 'p'; text: string } | { kind: 'h'; text: string } | { kind: 'ul'; items: string[] };

interface LegalSection {
  // Sin título para el texto inicial que va antes de la primera sección numerada.
  title?: string;
  blocks: LegalBlock[];
}

interface LegalDoc {
  title: string;
  // Línea «Última actualización…» bajo el título.
  updated: string;
  sections: LegalSection[];
}

const p = (text: string): LegalBlock => ({ kind: 'p', text });
const h = (text: string): LegalBlock => ({ kind: 'h', text });
const ul = (...items: string[]): LegalBlock => ({ kind: 'ul', items });

// Los dos textos legales son propios de Expenses y se publican tal cual los entregó el titular del sitio.
const PRIVACY: LegalDoc = {
  title: 'Política de privacidad',
  updated: 'Última actualización: 12 de noviembre de 2026',
  sections: [
    {
      title: '1. Alcance',
      blocks: [
        p('Esta política explica cómo se recopila y utiliza la información personal de las personas que visitan el sitio web público de Expenses, disponible en https://expenses.com.py.'),
        p('Esta política se refiere exclusivamente al sitio web público, sus formularios de contacto y su demostración pública. El tratamiento de datos dentro de la plataforma contratada por edificios y administraciones podrá estar sujeto a condiciones y documentos adicionales.')
      ]
    },
    {
      title: '2. Datos que podemos recopilar',
      blocks: [
        h('a) Datos proporcionados voluntariamente'),
        p('Cuando una persona utiliza nuestros formularios de contacto o solicita información comercial, podemos recibir su nombre, dirección de correo electrónico, número de teléfono y el contenido del mensaje.'),
        p('Los formularios pueden ser gestionados mediante servicios de terceros, como Hostinger Reach.'),
        h('b) Datos de navegación'),
        p('Podemos recopilar información técnica y estadística sobre la navegación, como páginas visitadas, interacciones, tipo de dispositivo, navegador y ubicación geográfica aproximada, mediante herramientas de analítica web, como Google Analytics, cuando estén habilitadas.'),
        h('c) Comunicaciones por WhatsApp'),
        p('Si una persona decide contactarnos mediante WhatsApp, recibiremos los datos y el contenido que voluntariamente comparta a través de ese servicio. El tratamiento de esos datos también puede estar sujeto a las condiciones y políticas de WhatsApp.'),
        h('d) Demostración pública'),
        p('La demostración pública de Expenses permite explorar funcionalidades sin crear una cuenta. Los datos de ejemplo son ficticios y no representan información real de propietarios, residentes o edificios.'),
        p('La navegación por la demostración puede generar datos estadísticos si las herramientas de analítica están habilitadas.')
      ]
    },
    {
      title: '3. Finalidades del tratamiento',
      blocks: [
        p('Utilizamos la información para:'),
        ul(
          'Responder consultas y solicitudes de información.',
          'Contactar a personas interesadas en conocer Expenses.',
          'Preparar propuestas comerciales y coordinar demostraciones.',
          'Analizar el uso del sitio web y mejorar su funcionamiento.',
          'Enviar comunicaciones comerciales únicamente cuando exista la autorización correspondiente.'
        ),
        p('No vendemos datos personales a terceros.')
      ]
    },
    {
      title: '4. Comunicaciones comerciales',
      blocks: [
        p('Los datos de contacto podrán utilizarse para enviar información comercial cuando la persona haya autorizado expresamente recibirla.'),
        p('La persona podrá retirar esa autorización en cualquier momento mediante el correo de privacidad indicado en esta política.'),
        p('La retirada de autorización no afecta a los tratamientos realizados legítimamente con anterioridad.')
      ]
    },
    {
      title: '5. Servicios de terceros',
      blocks: [
        p('Para operar el sitio y prestar sus funcionalidades, podemos utilizar proveedores tecnológicos que procesen información por cuenta propia o según nuestras instrucciones.'),
        p('Entre los servicios que podrían intervenir se encuentran:'),
        ul(
          'Hostinger: alojamiento web y gestión de formularios mediante Hostinger Reach, si corresponde.',
          'Google: herramientas de analítica web y servicios de fuentes tipográficas, si están habilitados.',
          'Meta / WhatsApp: canal de comunicación cuando la persona decide utilizarlo.'
        ),
        p('Estos proveedores pueden procesar información desde otros países, de acuerdo con sus condiciones y políticas aplicables. La lista definitiva deberá verificarse con la configuración técnica real del sitio.')
      ]
    },
    {
      title: '6. Conservación de los datos',
      blocks: [
        p('Los datos recibidos mediante consultas y formularios comerciales se conservarán durante un máximo de 12 meses desde la última interacción, salvo que exista una relación contractual, una obligación legal o una necesidad legítima que justifique conservarlos durante otro período.'),
        p('Los datos utilizados para comunicaciones comerciales se conservarán mientras exista la autorización correspondiente o hasta que la persona solicite dejar de recibirlas.'),
        p('Los datos estadísticos de navegación se conservarán según la configuración de retención de la herramienta de analítica utilizada.'),
        p('Los mensajes intercambiados mediante WhatsApp se conservarán conforme a las necesidades de atención y las condiciones aplicables al servicio.')
      ]
    },
    {
      title: '7. Derechos de las personas',
      blocks: [
        p('Las personas podrán solicitar, según corresponda:'),
        ul(
          'Acceso a sus datos personales.',
          'Rectificación de información incorrecta o incompleta.',
          'Eliminación de sus datos cuando proceda.',
          'Oposición a determinados tratamientos.',
          'Retirada de una autorización previamente otorgada.',
          'Portabilidad de sus datos cuando resulte aplicable.'
        ),
        p('Para ejercer estos derechos podrán utilizar el correo corporativo de privacidad indicado en esta política.'),
        p('Expenses establecerá un procedimiento para verificar la identidad de quien realiza la solicitud y responder dentro de los plazos aplicables.')
      ]
    },
    {
      title: '8. Cookies y tecnologías similares',
      blocks: [
        p('El sitio puede utilizar cookies y tecnologías similares para su funcionamiento y, si está habilitado, para obtener estadísticas de navegación mediante herramientas como Google Analytics.'),
        p('Actualmente no se dispone de un banner de consentimiento de cookies. Antes de publicar esta política deberá verificarse qué cookies y tecnologías se utilizan realmente y si corresponde implementar un mecanismo para aceptar, rechazar o configurar las cookies no esenciales.'),
        p('La configuración del navegador permite administrar o bloquear cookies, aunque esto puede afectar algunas funcionalidades del sitio.')
      ]
    },
    {
      title: '9. Seguridad',
      blocks: [
        p('Expenses adopta medidas técnicas y organizativas razonables para proteger la información frente al acceso no autorizado, pérdida, alteración o divulgación indebida.'),
        p('Ningún sistema de transmisión o almacenamiento de información puede garantizar seguridad absoluta.')
      ]
    },
    {
      title: '10. Enlaces externos',
      blocks: [
        p('El sitio puede contener enlaces a plataformas o servicios de terceros. Expenses no controla las políticas de privacidad ni las prácticas de tratamiento de datos de esos servicios.'),
        p('Se recomienda consultar las políticas correspondientes antes de proporcionar información personal en sitios externos.')
      ]
    },
    {
      title: '11. Modificaciones',
      blocks: [
        p('Esta política podrá actualizarse para reflejar cambios en los servicios, tecnologías utilizadas o requisitos legales.'),
        p('La versión vigente estará disponible en https://expenses.com.py.')
      ]
    }
  ]
};

const TERMS: LegalDoc = {
  title: 'Términos de uso del sitio web',
  updated: 'Última actualización: 12 de noviembre de 2026',
  sections: [
    {
      blocks: [
        p('Estos Términos de uso regulan el acceso y la utilización del sitio web público de Expenses, disponible en https://expenses.com.py.'),
        p('Al acceder, navegar o utilizar este sitio, el visitante acepta las condiciones aquí establecidas. Si no está de acuerdo con ellas, deberá abstenerse de utilizar el sitio.'),
        p('Estos términos regulan exclusivamente el sitio web público. La utilización de la plataforma de gestión por parte de edificios, condominios, administraciones, propietarios o residentes se encuentra sujeta a las condiciones comerciales, propuestas y contratos específicos que correspondan.')
      ]
    },
    {
      title: '1. Objeto del sitio web',
      blocks: [
        p('Expenses es una solución tecnológica destinada a facilitar la administración, gestión y control de edificios y condominios.'),
        p('El sitio web tiene como finalidad:'),
        ul(
          'Presentar información sobre Expenses y sus funcionalidades.',
          'Describir los módulos y servicios disponibles.',
          'Permitir explorar una demostración del sistema.',
          'Facilitar el contacto con el equipo comercial.',
          'Permitir solicitar información, asesoramiento y cotizaciones.'
        ),
        p('La información publicada tiene carácter general e informativo y no constituye por sí misma una oferta contractual vinculante.')
      ]
    },
    {
      title: '2. Información y funcionalidades de ejemplo',
      blocks: [
        p('El contenido del sitio, incluidas las descripciones, imágenes, capturas de pantalla, cifras y representaciones de funcionalidades, tiene una finalidad informativa y demostrativa.'),
        p('Las secciones identificadas como «Vista de ejemplo», así como las imágenes o representaciones de la plataforma, pueden mostrar datos ficticios o escenarios ilustrativos.'),
        p('La demostración pública utiliza un entorno de ejemplo y no representa información real de edificios, propietarios, residentes, proveedores ni administraciones.'),
        p('Las funcionalidades, módulos, características y condiciones comerciales de Expenses pueden evolucionar, actualizarse o variar según el plan contratado y las condiciones acordadas con cada cliente.'),
        p('Expenses procurará mantener la información del sitio actualizada, sin garantizar que todas las descripciones reflejen en todo momento la última versión disponible de la plataforma.')
      ]
    },
    {
      title: '3. Demostración pública',
      blocks: [
        p('Expenses puede ofrecer una demostración pública para que los visitantes conozcan y exploren determinadas funcionalidades del sistema.'),
        p('Esta demostración:'),
        ul(
          'Utiliza un entorno ficticio con datos de ejemplo.',
          'Tiene una finalidad exclusivamente informativa y demostrativa.',
          'No requiere necesariamente la creación de una cuenta.',
          'No constituye una contratación, período de prueba comercial ni compromiso de adquisición del servicio.',
          'No garantiza que todas las funcionalidades disponibles en la demostración estén incluidas en todos los planes comerciales.'
        ),
        p('El acceso a la demostración no autoriza al visitante a copiar, extraer, alterar, interferir o utilizar indebidamente sus contenidos, funcionalidades o recursos tecnológicos.')
      ]
    },
    {
      title: '4. Solicitudes de información y cotizaciones',
      blocks: [
        p('Los visitantes pueden utilizar los canales habilitados en el sitio para solicitar información, coordinar demostraciones o pedir cotizaciones.'),
        p('El envío de una consulta o solicitud no genera una obligación de contratación para ninguna de las partes.'),
        p('Las propuestas comerciales, cotizaciones y condiciones económicas serán comunicadas por los canales correspondientes y podrán incluir información sobre:'),
        ul(
          'Alcance del servicio.',
          'Módulos y funcionalidades incluidos.',
          'Precio y modalidad de pago.',
          'Períodos de prueba o beneficios comerciales.',
          'Condiciones de implementación y puesta en marcha.',
          'Obligaciones y responsabilidades de las partes.'
        ),
        p('Una propuesta comercial solo se considerará aceptada cuando exista una manifestación de aceptación verificable por los medios acordados entre las partes.'),
        p('La contratación del servicio quedará sujeta a las condiciones particulares de la propuesta o contrato correspondiente.')
      ]
    },
    {
      title: '5. Uso permitido del sitio',
      blocks: [
        p('El visitante se compromete a utilizar el sitio de forma lícita, responsable y conforme a estos términos y a la legislación aplicable en la República del Paraguay.'),
        p('Queda prohibido:'),
        ul(
          'Utilizar el sitio con fines ilegales o fraudulentos.',
          'Intentar acceder sin autorización a sistemas, servidores, cuentas o información.',
          'Alterar, dañar o interferir con el funcionamiento del sitio.',
          'Introducir código malicioso, virus o cualquier elemento que pueda comprometer su seguridad.',
          'Realizar actividades automatizadas que generen cargas indebidas o afecten la disponibilidad del servicio.',
          'Copiar, reproducir, distribuir o explotar comercialmente contenidos protegidos sin autorización.',
          'Utilizar la demostración para obtener, extraer o divulgar información de manera no autorizada.'
        ),
        p('Expenses podrá adoptar medidas razonables para proteger el sitio y restringir accesos cuando detecte usos que puedan comprometer su seguridad, integridad o funcionamiento.')
      ]
    },
    {
      title: '6. Propiedad intelectual e industrial',
      blocks: [
        p('La marca Expenses, su identidad visual, logotipos, diseño, textos, imágenes, elementos gráficos, software, estructura y demás contenidos del sitio están protegidos por las normas aplicables de propiedad intelectual e industrial.'),
        p('Dichos elementos pertenecen a sus respectivos titulares o se utilizan con las autorizaciones correspondientes.'),
        p('El acceso al sitio no concede al visitante ningún derecho de propiedad, licencia comercial ni autorización para reproducir, modificar, distribuir, publicar o explotar dichos elementos.'),
        p('Cualquier utilización no autorizada deberá contar previamente con el consentimiento del titular correspondiente, salvo los usos expresamente permitidos por la legislación aplicable.')
      ]
    },
    {
      title: '7. Enlaces y servicios de terceros',
      blocks: [
        p('El sitio puede incluir enlaces o integraciones con servicios de terceros, como WhatsApp, LinkedIn y otras plataformas externas.'),
        p('Estos servicios pueden contar con sus propias condiciones de uso, políticas de privacidad y mecanismos de funcionamiento.'),
        p('Expenses no controla ni asume responsabilidad por la disponibilidad, contenidos, políticas, prácticas o funcionamiento de plataformas externas.'),
        p('El acceso y utilización de dichos servicios se realiza bajo responsabilidad del usuario y conforme a las condiciones establecidas por sus respectivos proveedores.')
      ]
    },
    {
      title: '8. Disponibilidad y responsabilidad',
      blocks: [
        p('Expenses realizará esfuerzos razonables para mantener el sitio disponible, seguro y actualizado.'),
        p('Sin embargo, no garantiza que el acceso sea permanente, ininterrumpido o libre de errores, ni que el sitio esté disponible en todo momento.'),
        p('El funcionamiento puede verse afectado por tareas de mantenimiento, actualizaciones, fallos técnicos, problemas de conectividad, interrupciones de proveedores externos o circunstancias ajenas al control de Expenses.'),
        p('En la medida permitida por la legislación aplicable, Expenses no será responsable por daños derivados exclusivamente de interrupciones, indisponibilidad temporal, errores de visualización o fallos de servicios externos que no le sean imputables.'),
        p('Esta disposición no excluye ni limita responsabilidades que legalmente no puedan excluirse, ni afecta los derechos irrenunciables que correspondan a los usuarios conforme a la legislación vigente.')
      ]
    },
    {
      title: '9. Protección de datos personales',
      blocks: [
        p('El tratamiento de los datos personales que puedan recopilarse mediante formularios, canales de contacto y herramientas de navegación se rige por la Política de privacidad de Expenses, disponible en:'),
        p('https://expenses.com.py/'),
        p('Al utilizar los formularios o canales de contacto, el visitante deberá proporcionar información veraz y evitar enviar datos personales de terceros sin contar con autorización para hacerlo.')
      ]
    },
    {
      title: '10. Modificaciones de los términos',
      blocks: [
        p('Expenses podrá actualizar o modificar estos términos cuando resulte necesario por cambios en el sitio, sus funcionalidades, servicios o requisitos legales.'),
        p('La versión vigente estará disponible en esta misma página e indicará su fecha de última actualización.'),
        p('Se recomienda consultar periódicamente este documento para conocer las condiciones aplicables al uso del sitio.')
      ]
    },
    {
      title: '11. Ley aplicable y jurisdicción',
      blocks: [
        p('Estos términos se interpretarán conforme a las leyes de la República del Paraguay.'),
        p('Cualquier controversia relacionada con el acceso o utilización del sitio se someterá a los órganos jurisdiccionales competentes de la República del Paraguay, de acuerdo con las reglas legales de competencia aplicables.'),
        p('En ningún caso esta disposición limitará los derechos o mecanismos de protección que correspondan legalmente a los usuarios.')
      ]
    },
    {
      title: '12. Contacto',
      blocks: [
        p('Para consultas relacionadas con estos términos de uso, los visitantes podrán utilizar los canales oficiales de contacto publicados en:'),
        p('https://expenses.com.py/')
      ]
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
      <h1>{{ doc.title }}</h1>
      <p class="updated">{{ doc.updated }}</p>
      @for (s of doc.sections; track $index) {
        <section>
          @if (s.title) { <h2>{{ s.title }}</h2> }
          @for (b of s.blocks; track $index) {
            @if (b.kind === 'h') {
              <h3>{{ b.text }}</h3>
            } @else if (b.kind === 'ul') {
              <ul>
                @for (item of b.items; track item) { <li>{{ item }}</li> }
              </ul>
            } @else {
              <p>{{ b.text }}</p>
            }
          }
        </section>
      }
    </main>
  `,
  styles: [
    `
      :host { display: block; min-height: 100vh; background: #fff; color: #16324a; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; line-height: 1.6; }
      .top { max-width: 46rem; margin: 0 auto; padding: 1rem 1.5rem 0; }
      .back { display: inline-flex; align-items: center; min-height: 44px; color: #0f6f9a; font-weight: 700; text-decoration: none; }
      .back:hover { text-decoration: underline; }
      .doc { max-width: 46rem; margin: 0 auto; padding: 0.5rem 1.5rem 4rem; }
      h1 { font-size: clamp(1.7rem, 4vw, 2.3rem); font-weight: 800; color: #11364a; margin: 1.2rem 0 0.4rem; line-height: 1.2; }
      h2 { font-size: 1.15rem; color: #11364a; margin: 1.8rem 0 0.4rem; }
      h3 { font-size: 1rem; color: #11364a; margin: 1.1rem 0 0.2rem; }
      p { margin: 0.5rem 0; color: #3b5463; overflow-wrap: anywhere; }
      ul { margin: 0.5rem 0; padding-left: 1.3rem; color: #3b5463; }
      li { margin: 0.25rem 0; }
      .updated { color: #4a6270; font-size: 0.9rem; margin-bottom: 1.2rem; }
    `
  ]
})
export class LegalPageComponent {
  readonly doc: LegalDoc = inject(ActivatedRoute).snapshot.data['doc'] === 'terms' ? TERMS : PRIVACY;

  constructor() {
    const isTerms = this.doc === TERMS;
    inject(SeoService).set({
      title: `${this.doc.title} | Expenses`,
      description: isTerms ? 'Términos de uso del sitio web de Expenses.' : 'Política de privacidad del sitio web de Expenses.',
      path: isTerms ? '/terminos' : '/privacidad',
      // Se mantiene fuera de Google; si se quiere indexar, basta con quitar esta línea.
      noindex: true
    });
  }
}
