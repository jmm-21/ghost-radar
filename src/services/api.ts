import { t } from '../i18n';
/**
 * Cliente del backend. Solo envía datos anónimos (tipo de evento y red social):
 * nunca nombres de usuario, listas ni archivos.
 * Si la API no está disponible, la app sigue funcionando igual.
 */
import type { AnalyticsEvent, FeedbackInput, PublicStats } from '../../shared/types';

export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    // Las estadísticas nunca deben romper la experiencia.
  }
}

export async function fetchStats(): Promise<PublicStats | null> {
  try {
    const res = await fetch('/api/stats');
    return res.ok ? ((await res.json()) as PublicStats) : null;
  } catch {
    return null;
  }
}

export async function sendFeedback(input: FeedbackInput): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? t('fb.failed') };
  } catch {
    return { ok: false, error: t('fb.offline') };
  }
}
