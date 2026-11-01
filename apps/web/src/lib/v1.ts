const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export async function v1<T>(path: string, token: string | null, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBase}/api/v1${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('No se pudo contactar la API.')
  }
  const payload = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) throw new Error(payload?.error ?? `Error ${response.status}`)
  return payload as T
}
