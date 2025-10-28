// src/api.js
export async function api(path, options = {}) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    method: options.method || "GET",
    credentials: "include",   // <— important
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || "Request failed");
  return data;
}
