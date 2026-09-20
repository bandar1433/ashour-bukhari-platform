import { createAuthClient } from '@neondatabase/neon-js/auth';

const authBaseUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const authClient = authBaseUrl ? createAuthClient(authBaseUrl) : null;

async function getAccessToken(): Promise<string | null> {
  if (!authClient) return null;

  try {
    const tokenResult = await authClient.token?.();

    if (typeof tokenResult === 'string') return tokenResult;
    if (tokenResult?.token) return tokenResult.token;
    if (tokenResult?.accessToken) return tokenResult.accessToken;
  } catch {
    // نكمل لمحاولة قراءة الجلسة
  }

  try {
    const sessionResult = await authClient.getSession?.();
    const session = sessionResult?.data ?? sessionResult;

    return (
      session?.session?.token ||
      session?.token ||
      session?.accessToken ||
      null
    );
  } catch {
    return null;
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

  return data;
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

    try {
      const sessionResult = await authClient.getSession?.();
      const session = sessionResult?.data ?? sessionResult;
      const user = session?.user ?? session?.session?.user ?? null;

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

    await authClient.signIn.social({
      provider: 'google',
      callbackURL: window.location.origin,
    });
  },

  async signOut() {
    if (!authClient) return;
    await authClient.signOut();
  },
};
