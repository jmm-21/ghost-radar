import type { Network } from '../../shared/types';
import type { Account } from '../core/types';

export interface NetworkConfig {
  name: string;
  /** Página oficial donde se pide la exportación (si existe un enlace estable). */
  exportLink?: { href: string; text: string };
  /** Pasos en HTML (contenido estático escrito por nosotros, no por el usuario). */
  steps: string[];
  note: string;
  beta?: boolean;
  profileUrl: (a: Account) => string;
}

const META_EXPORT = 'https://accountscenter.instagram.com/info_and_permissions/dyi/';

export const NETWORK_CONFIG: Record<Network, NetworkConfig> = {
  instagram: {
    name: 'Instagram',
    exportLink: { href: META_EXPORT, text: 'Abrir la página de exportación' },
    steps: [
      'Pulsa el botón de arriba e inicia sesión si te lo pide. <span class="alt">Desde la app: <b>Perfil → ☰</b> y escribe <b>“Exportar”</b> o <b>“Descargar tu información”</b> en el buscador de arriba.</span>',
      'Pulsa <b>Crear exportación</b> (o <b>Descargar o transferir información</b>) y elige tu perfil de Instagram.',
      'Elige <b>Exportar al dispositivo</b> (o <b>Descargar en el dispositivo</b>).',
      'En <b>Personalizar información</b>, pulsa <b>Borrar todo</b>, marca solo <b>Seguidores y seguidos</b> y guarda.',
      'Pon el intervalo en <b>Desde el principio</b> y el formato en <b>JSON</b>. ¡Importante!',
      'Pulsa <b>Iniciar exportación</b> (o <b>Crear archivos</b>). Te avisarán cuando el .zip esté listo y podrás descargarlo desde esa misma página.',
    ],
    note: 'Instagram cambia a menudo los nombres de los menús. Si alguno no coincide, busca el más parecido. Archivos que se usan: <code>followers_1.json</code> y <code>following.json</code>.',
    profileUrl: (a) => `https://www.instagram.com/${encodeURIComponent(a.handle)}/`,
  },
  tiktok: {
    name: 'TikTok',
    steps: [
      'En TikTok, ve a tu <b>Perfil → ☰ → Ajustes y privacidad</b>.',
      'Entra en <b>Cuenta → Descargar tus datos</b>.',
      'Selecciona los datos de <b>perfil y actividad</b> (o todos).',
      'Elige el formato <b>JSON</b> y pulsa <b>Solicitar datos</b>.',
      'Cuando esté listo (puede tardar hasta unos días), descárgalo en la pestaña <b>Descargar datos</b>.',
    ],
    note: 'Se lee la lista de seguidores y seguidos de <code>user_data_tiktok.json</code>. El formato TXT también vale.',
    profileUrl: (a) => `https://www.tiktok.com/@${encodeURIComponent(a.handle)}`,
  },
  x: {
    name: 'X',
    steps: [
      'En X, ve a <b>Más → Configuración y privacidad</b>.',
      'Entra en <b>Tu cuenta → Descargar un archivo de tus datos</b>.',
      'Confirma tu contraseña y el código de verificación.',
      'Pulsa <b>Solicitar archivo</b>. Suele tardar 24 horas o más.',
      'Descarga el .zip cuando te avisen y súbelo aquí.',
    ],
    note: 'Se usan <code>data/follower.js</code> y <code>data/following.js</code>. X solo guarda el número de cada cuenta, no su @nombre.',
    profileUrl: (a) =>
      a.id ? `https://x.com/i/user/${a.id}` : `https://x.com/${encodeURIComponent(a.handle)}`,
  },
  threads: {
    name: 'Threads',
    beta: true,
    exportLink: { href: META_EXPORT, text: 'Abrir la página de exportación de Meta' },
    steps: [
      'Pulsa el botón de arriba (Threads comparte la página de exportación con Instagram).',
      'Pulsa <b>Crear exportación</b> y elige tu perfil de <b>Threads</b>.',
      'Elige <b>Exportar al dispositivo</b> y, en <b>Personalizar información</b>, deja solo <b>seguidores y seguidos</b>.',
      'Formato <b>JSON</b>, intervalo <b>Desde el principio</b>, y pulsa <b>Iniciar exportación</b>.',
      'Descarga el .zip cuando te avisen.',
    ],
    note: 'En pruebas: los menús de Threads cambian a menudo. Si algo no cuadra, avísanos con el botón de opiniones.',
    profileUrl: (a) => `https://www.threads.com/@${encodeURIComponent(a.handle)}`,
  },
};
