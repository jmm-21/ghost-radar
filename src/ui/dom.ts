/** Obtiene un elemento por id y falla pronto si no existe (errores de maquetación visibles en desarrollo). */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id} en index.html`);
  return el as T;
}

type Child = Node | string | null | undefined | false;

/** Crea elementos sin innerHTML: el texto del usuario nunca se interpreta como HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) if (v !== undefined) el.setAttribute(k, v);
  for (const c of children) if (c) el.append(c);
  return el;
}

/** Icono SVG de "abrir en otra pestaña". */
export function externalIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.6');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M7 17 17 7M8 7h9v9');
  svg.append(path);
  return svg;
}

export function countUp(el: HTMLElement, to: number, suffix = ''): void {
  const duration = 900;
  const t0 = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / duration);
    const eased = 1 - (1 - p) ** 3;
    el.textContent = Math.round(to * eased).toLocaleString('es-ES') + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
