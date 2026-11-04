import { post } from './client';
// Concurrent page/provider effects must share a single first visitor-cookie creation.
let initialization: Promise<void> | undefined;
export function ensureShowcaseSession(): Promise<void> {
  return (initialization ??= post('demo/session', {})
    .then(() => undefined)
    .catch((error) => {
      initialization = undefined;
      throw error;
    }));
}
