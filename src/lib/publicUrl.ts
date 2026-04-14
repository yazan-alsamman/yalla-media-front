/** Prefix for files in `public/` when the app is served under a subpath (see `vite.config` `base`). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL
  const p = path.startsWith('/') ? path.slice(1) : path
  return `${base}${p}`
}
