/**
 * Respaldo de "Compartir → ghost.radar": normalmente el service worker recibe los archivos
 * sin que lleguen aquí. Si no está activo (primera visita, caché borrada), el servidor
 * no guarda nada: solo abre la herramienta para que la persona elija el archivo.
 */
export function POST(): Response {
  return new Response(null, { status: 303, headers: { Location: '/?compartido=1#analizar' } });
}
