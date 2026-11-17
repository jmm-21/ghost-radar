import { recordEvent } from '../server/handlers/index.js';
import { getStore } from '../server/lib/store.js';

export function POST(request: Request): Promise<Response> {
  return recordEvent(request, { store: getStore() });
}
