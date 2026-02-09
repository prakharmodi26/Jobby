const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  console.log(`[apiFetch] ${options?.method || "GET"} ${url}`);
  console.log(`[apiFetch] API_BASE = ${API_BASE}`);

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    console.log(`[apiFetch] Response: ${res.status} ${res.statusText}`);

    if (res.status === 401) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `API error: ${res.status}`);
    }

    return res.json();
  } catch (err) {
    console.error(`[apiFetch] Fetch failed for ${url}:`, err);
    throw err;
  }
}
