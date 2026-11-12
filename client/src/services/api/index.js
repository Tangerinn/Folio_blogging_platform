import { mockApi } from './mockApi.js';
import { realApi } from './realApi.js';

// The one switch. Set VITE_USE_MOCK=false in .env to talk to the real backend.
const useMock = import.meta.env?.VITE_USE_MOCK !== 'false';

export const api = useMock ? mockApi : realApi;
export const isMock = useMock;
export { ApiError } from './mockApi.js';
