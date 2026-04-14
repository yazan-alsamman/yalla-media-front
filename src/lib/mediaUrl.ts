function stripTrailingSlash(s: string) {
  return s.replace(/\/+$/, '')
}

/**
 * Absolute URL for uploaded files (e.g. top-up proof). Laravel often returns `/storage/...`
 * which is served from the app origin, not under `/api`.
 */
export function resolveMediaUrl(path: string): string {
  const p = String(path ?? '').trim()
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p

  const explicit = import.meta.env.VITE_BACKEND_PUBLIC_URL
  if (typeof explicit === 'string' && explicit.trim() !== '') {
    const base = stripTrailingSlash(explicit.trim())
    return p.startsWith('/') ? `${base}${p}` : `${base}/${p}`
  }

  const apiRaw = import.meta.env.VITE_API_URL
  const apiStr = typeof apiRaw === 'string' ? apiRaw.trim() : ''
  if (apiStr && typeof window !== 'undefined') {
    try {
      const base = apiStr.startsWith('http') ? new URL(apiStr) : new URL(apiStr, window.location.origin)
      let pathPart = stripTrailingSlash(base.pathname)
      if (/\/api$/i.test(pathPart)) {
        pathPart = pathPart.slice(0, -4) || '/'
      }
      const origin = `${base.origin}${pathPart === '/' ? '' : pathPart}`
      return p.startsWith('/') ? `${origin}${p}` : `${origin}/${p}`
    } catch {
      /* fall through */
    }
  }

  if (typeof window !== 'undefined') {
    return p.startsWith('/') ? `${window.location.origin}${p}` : p
  }
  return p
}
