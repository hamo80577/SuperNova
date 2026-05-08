const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

interface ApiErrorBody {
  message?: string | string[];
  error?: string;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const message = Array.isArray(body.message)
      ? body.message.join(" ")
      : body.message ?? body.error ?? "Request failed.";
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const getCache = new Map<string, CacheEntry<unknown>>();

export function clearApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    getCache.clear();
    return;
  }

  for (const key of getCache.keys()) {
    if (key.startsWith(pathPrefix)) {
      getCache.delete(key);
    }
  }
}

export async function apiGet<T>(
  path: string,
  options: { staleTime?: number } = {}
): Promise<T> {
  const staleTime = options.staleTime ?? 45_000;
  const cached = getCache.get(path) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = apiRequest<T>(path).catch((error) => {
    getCache.delete(path);
    throw error;
  });

  getCache.set(path, {
    expiresAt: now + staleTime,
    promise
  });

  return promise;
}
