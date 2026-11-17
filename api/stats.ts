import { getStats } from '../server/handlers/index.js';
import { getStore } from '../server/lib/store.js';

export function GET(request: Request): Promise<Response> {
  return getStats(request, { store: getStore() });
}
