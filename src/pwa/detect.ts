/** iPhone y iPad no tienen botón de instalar: hay que hacerlo desde Compartir. Los iPad modernos dicen ser un Mac. */
export const isIos = (ua: string, touchPoints: number): boolean =>
  /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && touchPoints > 1);
