const TOKEN_KEY = "fitai_token";

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface TokenPayload {
  user_id: string;
  tier: string;
  exp: number;
}

export function getUser(): TokenPayload | null {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as TokenPayload;
    if (payload.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return payload;
  } catch {
    clearToken();
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getUser() !== null;
}

interface UserMe {
  user_id: string;
  email: string;
  tier: string;
  sport: string | null;
  features: Record<string, boolean | number>;
}

export async function fetchUserMe(): Promise<UserMe | null> {
  const token = getToken();
  if (!token) return null;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  try {
    const res = await fetch(`${API_URL}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) clearToken();
      return null;
    }
    return res.json();
  } catch {
    return null;
  }
}
