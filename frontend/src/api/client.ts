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

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  if (USE_MOCK) {
    const result = await mockFetch({ method: 'POST', path, body: { file } })
    return result as T
  }

  const form = new FormData()
  form.append('file', file)

  const res = await fetch(path, { method: 'POST', body: form })

  if (!res.ok) {
    throw new Error(`Upload ${path} failed: ${res.status}`)
  }

  return res.json()
}
