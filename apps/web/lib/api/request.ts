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
