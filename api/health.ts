import { health } from '../server/handlers/index.js';
import { getStore } from '../server/lib/store.js';

export function GET(request: Request): Promise<Response> {
  return health(request, { store: getStore() });
}
