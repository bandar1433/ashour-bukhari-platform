import { createAuthClient } from '@neondatabase/neon-js/auth';

const authBaseUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const authClient = authBaseUrl ? createAuthClient(authBaseUrl) : null;

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

  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return { data };
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

export const api = {
  get: (path: string) => request(path, 'GET'),

  post: (path: string, body?: unknown) =>
    request(path, 'POST', body),

  put: (path: string, body?: unknown) =>
    request(path, 'PUT', body),

  delete: (path: string) =>
    request(path, 'DELETE'),
};

export const auth = {
  async getUser() {
    if (!authClient) return null;

    const client = authClient as any;

    try {
      const sessionResult = await client.getSession?.();
      const user = extractUser(sessionResult);

      if (!user) return null;

      return {
        userId: user.id || user.userId || user.sub || user.email,
        email: user.email,
        name: user.name || user.fullName || user.email,
      };
    } catch {
      return null;
    }
  },

  isSignedIn() {
    return true;
  },

  async signIn() {
    if (!authClient) {
      throw new Error('Neon Auth is not configured');
    }

    const client = authClient as any;

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
    if (!authClient) return;

    const client = authClient as any;

    await client.signOut?.();

    window.location.href = window.location.origin;
  },
};
