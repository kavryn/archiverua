export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    const data = await res.clone().json().catch(() => ({}));
    if (data.error === "AUTH_ERROR" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("API_FETCH_AUTH_ERROR"));
    }
  }
  return res;
}
