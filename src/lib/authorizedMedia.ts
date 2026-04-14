import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { AUTH_TOKEN_KEY } from './authToken'
import { resolveMediaUrl } from './mediaUrl'

/** Fetch binary route (e.g. top-up proof) with Bearer token — plain img/src cannot send Authorization. */
export async function fetchAuthorizedMedia(urlOrPath: string): Promise<{ blob: Blob; contentType: string }> {
  const url = resolveMediaUrl(urlOrPath)
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: {
      Accept: '*/*',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    timeout: 40000,
  })
  const contentType = String(res.headers['content-type'] ?? 'application/octet-stream')
  return { blob: new Blob([res.data], { type: contentType }), contentType }
}

export function useAuthorizedMediaUrl(src: string): { url: string | null; failed: boolean; loading: boolean } {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const s = src.trim()
    if (!s) {
      setUrl(null)
      setFailed(false)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setFailed(false)
    setUrl(null)

    void (async () => {
      try {
        const { blob } = await fetchAuthorizedMedia(s)
        if (cancelled) return
        const u = URL.createObjectURL(blob)
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = u
        setUrl(u)
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [src])

  return { url, failed, loading }
}
