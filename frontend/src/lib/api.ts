import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 30_000;
const LONG_TIMEOUT_MS = 120_000; // for plan generation

export async function api<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const { timeoutMs, ...fetchOptions } = options;
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Create timeout abort if no signal was provided
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let signal = fetchOptions.signal;
  if (!signal) {
    const controller = new AbortController();
    signal = controller.signal;
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }

    return res.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export { LONG_TIMEOUT_MS };
