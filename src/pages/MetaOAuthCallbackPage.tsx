import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SectionCard } from '../components/SectionCard'

export function MetaOAuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    const err = params.get('meta_error')
    const ok = params.get('meta_connected')
    if (ok === '1') {
      setNote('Meta account connected. You can close this tab or return to integrations.')
    } else if (err) {
      setNote(`Connection failed: ${err}`)
    } else {
      setNote('No OAuth result in URL. Return to integrations and try again.')
    }
    const t = window.setTimeout(() => navigate('/integrations', { replace: true }), ok === '1' ? 2500 : 5000)
    return () => window.clearTimeout(t)
  }, [params, navigate])

  return (
    <section className="page-grid">
      <div className="page-title">
        <h2>Meta connection</h2>
        <p>Completing sign-in…</p>
      </div>
      <SectionCard title="Status">
        <p className={note?.startsWith('Connection failed') ? 'login-error' : 'muted'}>{note ?? '…'}</p>
      </SectionCard>
    </section>
  )
}
