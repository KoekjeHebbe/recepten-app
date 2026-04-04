const API_BASE = 'https://thenextprepisode.minglemurders.com/api'

function getToken(): string | null {
  return localStorage.getItem('recepten-token')
}

async function request<T>(
  pad: string,
  opties: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opties.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${pad}`, { ...opties, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'API fout')
  return data as T
}

export const api = {
  get: <T>(pad: string) => request<T>(pad),
  post: <T>(pad: string, body: unknown) => request<T>(pad, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(pad: string, body: unknown) => request<T>(pad, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(pad: string) => request<T>(pad, { method: 'DELETE' }),
}
