// src/api.js
export async function api(path, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    ...rest
  } = options;

  // In development we proxy /api to backend via Vite dev server so use relative path
  // Set VITE_API_URL to override (e.g., for production builds)
  const base = import.meta.env.VITE_API_URL ?? "";
  const url = `${base}${path}`;

  const isFormData = body instanceof FormData;

  const fetchOptions = {
    method,
    credentials: "include",
    headers: {
      ...(body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...rest,
  };

  if (body) {
    fetchOptions.body = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(url, fetchOptions);
  const text = await res.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Non-JSON response from", url, text.slice(0, 200));
      throw new Error("Unexpected response from server (not JSON)");
    }
  }

  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
