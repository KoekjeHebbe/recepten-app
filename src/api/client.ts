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

  // 401 → token verlopen of ongeldig: opruimen en de app laten reageren
  if (res.status === 401) {
    localStorage.removeItem('recepten-token')
    window.dispatchEvent(new Event('auth:uitgelogd'))
    throw new Error('Je sessie is verlopen. Log opnieuw in.')
  }

  // Lees de body veilig: DELETE/204/lege of niet-JSON antwoorden mogen niet crashen
  const tekst = await res.text()
  let data: unknown = null
  if (tekst) {
    try { data = JSON.parse(tekst) } catch { data = null }
  }

  if (!res.ok) {
    const melding =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `API fout (${res.status})`
    throw new Error(melding)
  }
  return data as T
}

export const api = {
  get: <T>(pad: string) => request<T>(pad),
  post: <T>(pad: string, body: unknown) => request<T>(pad, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(pad: string, body: unknown) => request<T>(pad, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(pad: string) => request<T>(pad, { method: 'DELETE' }),
}
