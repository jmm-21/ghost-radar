import { createHash } from 'node:crypto';

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

export function error(status: number, message: string): Response {
  return json({ error: message }, status);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Lee el cuerpo JSON con un límite de tamaño para evitar abusos. */
export async function readJson(req: Request, maxBytes = 4096): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'El cuerpo de la petición es demasiado grande.');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'JSON no válido.');
  }
}

/**
 * Identificador anónimo del cliente para limitar peticiones.
 * Nunca se guarda la IP: solo un hash con sal que además cambia cada día.
 */
export function anonymousClientId(req: Request, now = new Date(), salt = process.env.HASH_SALT ?? 'ghost.radar'): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const day = now.toISOString().slice(0, 10);
  return createHash('sha256').update(`${salt}:${day}:${ip}`).digest('hex').slice(0, 16);
}

/** Envuelve un handler para convertir `HttpError` y errores inesperados en respuestas JSON. */
export function withErrors(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof HttpError) return error(err.status, err.message);
    console.error('[ghost.radar] Error inesperado', err);
    return error(500, 'Error interno. Inténtalo de nuevo más tarde.');
  });
}
