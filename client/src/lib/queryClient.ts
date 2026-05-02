import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Read the CSRF token from the __Host-marcall_csrf cookie.
 * This cookie is HttpOnly=false so JS can read it (it is the consent record, not a secret).
 * We send it back in X-CSRF-Token header for double-submit verification (Control 11).
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)__Host-marcall_csrf=([^;]+)/);
  // Fall back to un-prefixed name in dev environments
  if (!match) {
    const devMatch = document.cookie.match(/(?:^|;\s*)marcall_csrf=([^;]+)/);
    return devMatch ? decodeURIComponent(devMatch[1]) : null;
  }
  return match ? decodeURIComponent(match[1]) : null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  // Attach CSRF token for state-mutating requests (Control 11)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL by treating first element as the base path; remaining string/number
    // segments are appended as path parts.
    const segments = queryKey as readonly (string | number)[];
    const url = segments.map((s, i) => i === 0 ? String(s) : encodeURIComponent(String(s))).join("/");
    const res = await fetch(`${API_BASE}${url}`, { credentials: "include" });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
