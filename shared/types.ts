/**
 * Tipos compartidos entre el frontend (src/) y el backend (server/, api/).
 * Mantenerlos en un único sitio garantiza que cliente y API hablan el mismo idioma.
 */

export const NETWORKS = ['instagram', 'tiktok', 'x', 'threads'] as const;
export type Network = (typeof NETWORKS)[number];

export function isNetwork(value: unknown): value is Network {
  return typeof value === 'string' && (NETWORKS as readonly string[]).includes(value);
}

/** Eventos anónimos que el frontend puede enviar a POST /api/events. */
export const EVENT_TYPES = ['analysis_completed', 'demo_used'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface AnalyticsEvent {
  type: EventType;
  network: Network;
}

/** Respuesta pública de GET /api/stats. */
export interface PublicStats {
  totalAnalyses: number;
  byNetwork: Record<Network, number>;
}

/** Cuerpo de POST /api/feedback. */
export interface FeedbackInput {
  message: string;
  rating?: number;
  contact?: string;
}

export interface FeedbackEntry extends FeedbackInput {
  id: string;
  createdAt: string;
}

export const FEEDBACK_LIMITS = {
  messageMin: 3,
  messageMax: 1000,
  contactMax: 120,
} as const;
