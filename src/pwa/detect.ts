export type Platform = 'ios' | 'android' | 'desktop';

/** iPhone y iPad no tienen botón de instalar: hay que hacerlo desde Compartir. Los iPad modernos dicen ser un Mac. */
export const isIos = (ua: string, touchPoints: number): boolean =>
  /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && touchPoints > 1);

/** Plataforma, para destacar los pasos que le tocan a cada persona. */
export function platformOf(ua: string, touchPoints: number): Platform {
  if (isIos(ua, touchPoints)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}
