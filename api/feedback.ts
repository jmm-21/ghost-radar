import { listFeedback, submitFeedback } from '../server/handlers/index.js';
import { getStore } from '../server/lib/store.js';

export function POST(request: Request): Promise<Response> {
  return submitFeedback(request, { store: getStore() });
}

export function GET(request: Request): Promise<Response> {
  return listFeedback(request, { store: getStore() });
}
