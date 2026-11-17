import { FEEDBACK_LIMITS } from '../../shared/types';
import { sendFeedback } from '../services/api';
import { byId, h } from './dom';

/** Formulario de opiniones en un <dialog> nativo (accesible y sin dependencias). */
export function initFeedback(): void {
  const dialog = byId<HTMLDialogElement>('fbDialog');
  const form = byId<HTMLFormElement>('fbForm');
  const message = byId<HTMLTextAreaElement>('fbMessage');
  const contact = byId<HTMLInputElement>('fbContact');
  const msg = byId('fbMsg');
  const send = byId<HTMLButtonElement>('fbSend');
  const stars = byId('stars');
  let rating: number | undefined;

  for (let i = 1; i <= 5; i++) {
    const b = h('button', { type: 'button', 'aria-pressed': 'false', 'aria-label': `${i} de 5` }, '★');
    b.addEventListener('click', () => {
      rating = rating === i ? undefined : i;
      stars.querySelectorAll('button').forEach((s, idx) => s.setAttribute('aria-pressed', String(rating !== undefined && idx < rating)));
    });
    stars.append(b);
  }

  const setMsg = (text: string, kind: '' | 'ok' | 'err' = '') => {
    msg.textContent = text;
    msg.className = `fb-msg ${kind}`;
  };

  byId('fbOpen').addEventListener('click', () => {
    setMsg('');
    dialog.showModal();
    message.focus();
  });
  byId('fbCancel').addEventListener('click', () => dialog.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = message.value.trim();
    if (text.length < FEEDBACK_LIMITS.messageMin) {
      setMsg('Escribe al menos unas palabras.', 'err');
      return;
    }
    send.disabled = true;
    setMsg('Enviando…');
    const result = await sendFeedback({ message: text, rating, contact: contact.value.trim() || undefined });
    send.disabled = false;
    if (result.ok) {
      setMsg('¡Gracias! Lo hemos recibido. 👻', 'ok');
      form.reset();
      rating = undefined;
      stars.querySelectorAll('button').forEach((s) => s.setAttribute('aria-pressed', 'false'));
      setTimeout(() => dialog.close(), 1400);
    } else {
      setMsg(result.error, 'err');
    }
  });
}
