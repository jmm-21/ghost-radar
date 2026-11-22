import type { Network } from '../../shared/types';
import type { Account } from '../core/types';
import type { Lang } from '../i18n';

/** Instrucciones de una red en un idioma. HTML estático escrito por nosotros, no por el usuario. */
export interface NetworkText {
  exportLinkText?: string;
  steps: string[];
  note: string;
}

export interface NetworkConfig {
  name: string;
  /** Página oficial donde se pide la exportación (si existe un enlace estable). */
  exportHref?: string;
  /** Vídeo que enseña la exportación (public/videos/<nombre>-<idioma>.mp4). */
  video?: string;
  text: Record<Lang, NetworkText>;
  beta?: boolean;
  profileUrl: (a: Account) => string;
}

const META_EXPORT = 'https://accountscenter.instagram.com/info_and_permissions/dyi/';

export const NETWORK_CONFIG: Record<Network, NetworkConfig> = {
  instagram: {
    name: 'Instagram',
    exportHref: META_EXPORT,
    video: 'exportar-instagram',
    text: {
      es: {
        exportLinkText: 'Abrir la página de exportación',
        steps: [
          'Pulsa el botón de arriba e inicia sesión si te lo pide. <span class="alt">Desde la app: <b>Perfil → ☰</b> y escribe <b>“Exportar”</b> o <b>“Descargar tu información”</b> en el buscador de arriba.</span>',
          'Pulsa <b>Crear exportación</b> (o <b>Descargar o transferir información</b>) y elige tu perfil de Instagram.',
          'Elige <b>Exportar al dispositivo</b> (o <b>Descargar en el dispositivo</b>).',
          'En <b>Personalizar información</b>, pulsa <b>Borrar todo</b>, marca solo <b>Seguidores y seguidos</b> y guarda.',
          'Pon el intervalo en <b>Cualquier fecha</b> (o <b>Desde el principio</b>) y el formato en <b>JSON</b>. ¡Importante!',
          'Pulsa <b>Iniciar exportación</b> (o <b>Crear archivos</b>). Te avisarán cuando el .zip esté listo y podrás descargarlo desde esa misma página.',
        ],
        note: 'Instagram cambia a menudo los nombres de los menús. Si alguno no coincide, busca el más parecido. Archivos que se usan: <code>followers_1.json</code> y <code>following.json</code>.',
      },
      en: {
        exportLinkText: 'Open the export page',
        steps: [
          'Tap the button above and log in if asked. <span class="alt">From the app: <b>Profile → ☰</b> and type <b>“Export”</b> or <b>“Download your information”</b> in the search box at the top.</span>',
          'Tap <b>Create export</b> (or <b>Download or transfer information</b>) and choose your Instagram profile.',
          'Choose <b>Export to device</b> (or <b>Download to device</b>).',
          'In <b>Customize information</b>, tap <b>Clear all</b>, tick only <b>Followers and following</b> and save.',
          'Set the date range to <b>All time</b> and the format to <b>JSON</b>. Important!',
          'Tap <b>Start export</b> (or <b>Create files</b>). You’ll be notified when the .zip is ready and can download it from that same page.',
        ],
        note: 'Instagram often renames its menus. If one doesn’t match, pick the closest one. Files used: <code>followers_1.json</code> and <code>following.json</code>.',
      },
    },
    profileUrl: (a) => `https://www.instagram.com/${encodeURIComponent(a.handle)}/`,
  },
  tiktok: {
    name: 'TikTok',
    text: {
      es: {
        steps: [
          'En TikTok, ve a tu <b>Perfil → ☰ → Ajustes y privacidad</b>.',
          'Entra en <b>Cuenta → Descargar tus datos</b>.',
          'Selecciona los datos de <b>perfil y actividad</b> (o todos).',
          'Elige el formato <b>JSON</b> y pulsa <b>Solicitar datos</b>.',
          'Cuando esté listo (puede tardar hasta unos días), descárgalo en la pestaña <b>Descargar datos</b>.',
        ],
        note: 'Se lee la lista de seguidores y seguidos de <code>user_data_tiktok.json</code>. El formato TXT también vale.',
      },
      en: {
        steps: [
          'In TikTok, go to your <b>Profile → ☰ → Settings and privacy</b>.',
          'Open <b>Account → Download your data</b>.',
          'Select your <b>profile and activity</b> data (or everything).',
          'Choose the <b>JSON</b> format and tap <b>Request data</b>.',
          'When it’s ready (it can take a few days), download it from the <b>Download data</b> tab.',
        ],
        note: 'The followers and following lists are read from <code>user_data_tiktok.json</code>. The TXT format works too.',
      },
    },
    profileUrl: (a) => `https://www.tiktok.com/@${encodeURIComponent(a.handle)}`,
  },
  x: {
    name: 'X',
    text: {
      es: {
        steps: [
          'En X, ve a <b>Más → Configuración y privacidad</b>.',
          'Entra en <b>Tu cuenta → Descargar un archivo de tus datos</b>.',
          'Confirma tu contraseña y el código de verificación.',
          'Pulsa <b>Solicitar archivo</b>. Suele tardar 24 horas o más.',
          'Descarga el .zip cuando te avisen y súbelo aquí.',
        ],
        note: 'Se usan <code>data/follower.js</code> y <code>data/following.js</code>. X solo guarda el número de cada cuenta, no su @nombre.',
      },
      en: {
        steps: [
          'In X, go to <b>More → Settings and privacy</b>.',
          'Open <b>Your account → Download an archive of your data</b>.',
          'Confirm your password and the verification code.',
          'Tap <b>Request archive</b>. It usually takes 24 hours or more.',
          'Download the .zip when you’re notified and upload it here.',
        ],
        note: 'It uses <code>data/follower.js</code> and <code>data/following.js</code>. X only stores each account’s number, not its @name.',
      },
    },
    profileUrl: (a) => (a.id ? `https://x.com/i/user/${a.id}` : `https://x.com/${encodeURIComponent(a.handle)}`),
  },
  threads: {
    name: 'Threads',
    beta: true,
    exportHref: META_EXPORT,
    text: {
      es: {
        exportLinkText: 'Abrir la página de exportación de Meta',
        steps: [
          'Pulsa el botón de arriba (Threads comparte la página de exportación con Instagram).',
          'Pulsa <b>Crear exportación</b> y elige tu perfil de <b>Threads</b>.',
          'Elige <b>Exportar al dispositivo</b> y, en <b>Personalizar información</b>, deja solo <b>seguidores y seguidos</b>.',
          'Formato <b>JSON</b>, intervalo <b>Cualquier fecha</b> (o <b>Desde el principio</b>), y pulsa <b>Iniciar exportación</b>.',
          'Descarga el .zip cuando te avisen.',
        ],
        note: 'En pruebas: los menús de Threads cambian a menudo. Si algo no cuadra, avísanos con el botón de opiniones.',
      },
      en: {
        exportLinkText: 'Open Meta’s export page',
        steps: [
          'Tap the button above (Threads shares its export page with Instagram).',
          'Tap <b>Create export</b> and choose your <b>Threads</b> profile.',
          'Choose <b>Export to device</b> and, in <b>Customize information</b>, keep only <b>followers and following</b>.',
          'Format <b>JSON</b>, date range <b>All time</b>, then tap <b>Start export</b>.',
          'Download the .zip when you’re notified.',
        ],
        note: 'In testing: Threads menus change often. If something doesn’t match, let us know with the feedback button.',
      },
    },
    profileUrl: (a) => `https://www.threads.com/@${encodeURIComponent(a.handle)}`,
  },
};
