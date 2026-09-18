import { createAuthClient } from '@neondatabase/neon-js/auth';

type RequestOptions = Record<string, unknown> | undefined;

type NeonAuthUser = {
  id?: string;
  userId?: string;
  email?: string;
  name?: string;
};

const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';

const createNeonAuthClient = createAuthClient as unknown as (url: string, options?: unknown) => any;
const authClient = authUrl
  ? createNeonAuthClient(authUrl, { fetchOptions: { credentials: 'include' } })
  : null;

async function readError(response: Response) {
  try {
    return await response.json();
  } catch {
    return { message: `HTTP ${response.status}` };
  }
}

async function getJwtToken(): Promise<string | null> {
  if (!authClient) return null;
  const result = await (authClient as any).token?.();
  return result?.data?.token || result?.token || null;
}

async function request(method: string, path: string, payload?: RequestOptions) {
  const token = await getJwtToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    credentials: 'include',
  });
  const data = response.status === 204 ? null : await readError(response);
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || 'تعذر إتمام الطلب') as Error & {
      response?: { data: unknown; status: number };
    };
    error.response = { data, status: response.status };
    throw error;
  }
  return { data };
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, data?: RequestOptions) => request('POST', path, data),
  put: (path: string, data?: RequestOptions) => request('PUT', path, data),
  delete: (path: string) => request('DELETE', path),
};

export const auth = {
  async getUser() {
    if (!authClient) return null;
    const result = await (authClient as any).getSession?.();
    const user: NeonAuthUser | undefined = result?.data?.user || result?.user;
    if (!user) {
      localStorage.removeItem('ashour_neon_auth_started');
      return null;
    }
    localStorage.setItem('ashour_neon_auth_started', '1');
    return {
      userId: user.id || user.userId || '',
      email: user.email || '',
      name: user.name || user.email || 'مستخدم',
    };
  },
  isSignedIn() {
    return localStorage.getItem('ashour_neon_auth_started') === '1';
  },
  async signIn() {
    if (!authClient) {
      const err = new Error('لم يتم ضبط رابط تسجيل الدخول VITE_NEON_AUTH_URL') as Error & { code?: string };
      err.code = 'auth_not_configured';
      throw err;
    }
    localStorage.setItem('ashour_neon_auth_started', '1');
    const callbackURL = window.location.origin;
    if ((authClient as any).signIn?.social) {
      return (authClient as any).signIn.social({ provider: 'google', callbackURL });
    }
    throw new Error('طريقة تسجيل الدخول غير متاحة في مكتبة المصادقة الحالية');
  },
  async signOut() {
    if (authClient) await (authClient as any).signOut?.();
    localStorage.removeItem('ashour_neon_auth_started');
  },
};
