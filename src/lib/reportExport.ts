import { getStoredToken } from './authToken'

/** Full URL for API path like `reports/widgets` (no leading slash required). */
export function apiPath(path: string): string {
  const p = path.replace(/^\//, '')
  const raw = import.meta.env.VITE_API_URL
  if (raw != null && String(raw).trim() !== '') {
    const base = String(raw).replace(/\/+$/, '')
    return `${base}/${p}`
  }
  return `/api/${p}`
}

export async function fetchJsonAuthed(path: string): Promise<unknown> {
  const token = getStoredToken()
  const res = await fetch(apiPath(path), {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json()
}

function buildExportUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString()
  return `${apiPath('reports/export')}?${search}`
}

export async function downloadReportCsv(kind: string, range: string): Promise<void> {
  const token = getStoredToken()
  const url = buildExportUrl({ format: 'csv', kind, range })
  const res = await fetch(url, {
    headers: {
      Accept: 'text/csv',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`)
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition')
  const match = cd?.match(/filename="?([^";]+)"?/)
  const name = match?.[1] ?? `yalla-report-${Date.now()}.csv`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function fetchReportJson(kind: string, range: string): Promise<unknown> {
  const token = getStoredToken()
  const url = buildExportUrl({ format: 'json', kind, range })
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`Export failed (${res.status})`)
  return res.json()
}
