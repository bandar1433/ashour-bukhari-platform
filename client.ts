import { createAuthClient } from '@neondatabase/neon-js/auth';

const authBaseUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';

const createNeonAuthClient = createAuthClient as unknown as (
  url: string,
  options?: unknown,
) => any;

const authClient = authBaseUrl
  ? createNeonAuthClient(authBaseUrl, {
      fetchOptions: { credentials: 'include' },
    })
  : null;

function extractToken(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;

  return (
    value.token ||
    value.accessToken ||
    value.jwt ||
    value.idToken ||
    value.data?.token ||
    value.data?.accessToken ||
    value.data?.jwt ||
    value.data?.idToken ||
    value.data?.session?.token ||
    value.data?.session?.accessToken ||
    value.data?.session?.jwt ||
    value.data?.session?.idToken ||
    value.session?.token ||
    value.session?.accessToken ||
    value.session?.jwt ||
    value.session?.idToken ||
    null
  );
}

function extractUser(value: any): any | null {
  if (!value) return null;

  return (
    value.user ||
    value.data?.user ||
    value.session?.user ||
    value.data?.session?.user ||
    null
  );
}

async function getAccessToken(): Promise<string | null> {
  if (!authClient) return null;

  const client = authClient as any;

  try {
    const jwt = await client.getJWTToken?.();
    const token = extractToken(jwt);
    if (token) return token;
  } catch {}

  try {
    const jwt = await client.jwt?.();
    const token = extractToken(jwt);
    if (token) return token;
  } catch {}

  try {
    const tokenResult = await client.token?.();
    const token = extractToken(tokenResult);
    if (token) return token;
  } catch {}

  try {
    const sessionResult = await client.getSession?.();
    const token = extractToken(sessionResult);
    if (token) return token;
  } catch {}

  return null;
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(path: string, method: string = 'GET', body?: unknown) {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const data = await readResponse(response);

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || `Request failed with status ${response.status}`,
    ) as Error & { response?: { data: unknown; status: number } };

    error.response = { data, status: response.status };
    throw error;
  }

  return { data };
}

export const api = {
  get: (path: string) => request(path, 'GET'),
  post: (path: string, body?: unknown) => request(path, 'POST', body),
  put: (path: string, body?: unknown) => request(path, 'PUT', body),
  delete: (path: string) => request(path, 'DELETE'),
};

export const auth = {
  async getUser() {
    if (!authClient) return null;

    const client = authClient as any;

    try {
      const sessionResult = await client.getSession?.();
      const user = extractUser(sessionResult);

      if (!user) {
        localStorage.removeItem('ashour_neon_auth_started');
        return null;
      }

      localStorage.setItem('ashour_neon_auth_started', '1');

      return {
        userId: user.id || user.userId || user.sub || user.email || '',
        email: user.email || '',
        name: user.name || user.fullName || user.email || 'مستخدم',
      };
    } catch {
      localStorage.removeItem('ashour_neon_auth_started');
      return null;
    }
  },

  isSignedIn() {
    return localStorage.getItem('ashour_neon_auth_started') === '1';
  },

  async signIn() {
    if (!authClient) {
      throw new Error('Neon Auth is not configured');
    }

    const client = authClient as any;

    localStorage.setItem('ashour_neon_auth_started', '1');

    const result = await client.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin,
    });

    const redirectUrl =
      result?.url ||
      result?.data?.url ||
      result?.redirectUrl ||
      result?.data?.redirectUrl;

    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  async signOut() {
    if (authClient) {
      const client = authClient as any;
      await client.signOut?.();
    }

    localStorage.removeItem('ashour_neon_auth_started');
    window.location.href = window.location.origin;
  },
};
