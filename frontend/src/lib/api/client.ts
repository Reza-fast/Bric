/** Same-origin `/api` (rewritten to Express in dev). Always send cookies. */
export function apiUrl(path: string): string {
  if (path.startsWith("/")) return path;
  return `/${path}`;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const isFormData =
    typeof FormData !== "undefined" && init?.body !== undefined && init.body instanceof FormData;
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers: isFormData
      ? { ...(init?.headers ?? {}) }
      : {
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
  });
}
