import { mockFetch } from './mock/handlers'

const USE_MOCK = import.meta.env.VITE_MOCK_API !== 'false'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

export async function api<T>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<T> {
  if (USE_MOCK) {
    const result = await mockFetch({ method, path, body })
    return result as T
  }

  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    throw new Error(`API ${method} ${path} failed: ${res.status}`)
  }

  return res.json()
}
