import { Moon, SunMedium } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { publicUrl } from '../lib/publicUrl'
import { t } from '../i18n'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, theme, setTheme, language, authReady, isAuthenticated } = useAppContext()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [typesPreview, setTypesPreview] = useState<{ id: number; name?: string; display_name?: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authReady && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [authReady, isAuthenticated, navigate])

  useEffect(() => {
    void (async () => {
      try {
        const res = (await api.get('/campaign-types')) as { data?: { id: number; name?: string; display_name?: string }[] }
        setTypesPreview(Array.isArray(res.data) ? res.data.slice(0, 8) : [])
      } catch {
        setTypesPreview([])
      }
    })()
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register({
        name,
        email,
        phone: phone || undefined,
        password,
        password_confirmation: passwordConfirmation,
      })
      navigate('/dashboard')
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Registration failed'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="login-page">
      <article className="login-card" style={{ maxWidth: 480 }}>
        <div className="login-head">
          <div className="login-brand">
            <img src={publicUrl('logo.png')} alt="" className="login-brand__logo" width={52} height={52} />
            <div className="login-brand__text">
              <h1 className="login-brand__title">{t(language, 'brand.name')}</h1>
              <p className="login-brand__subtitle">{t(language, 'register.subtitle')}</p>
            </div>
          </div>
          <div className="login-head__controls">
            <button className="icon-btn icon-btn--plain" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <SunMedium size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>

        <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            <span>{t(language, 'register.fullName')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </label>
          <label>
            <span>{t(language, 'login.email')}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            <span>{t(language, 'register.phoneOptional')}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </label>
          <label>
            <span>{t(language, 'login.password')}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          </label>
          <label>
            <span>{t(language, 'register.confirmPassword')}</span>
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          {error ? <p className="login-error">{error}</p> : null}
          <button type="submit" className="primary-btn login-submit" disabled={submitting}>
            {submitting ? '…' : t(language, 'register.createAccount')}
          </button>
        </form>

        {typesPreview.length > 0 ? (
          <div className="muted" style={{ marginTop: 16, fontSize: 13 }}>
            <strong>{t(language, 'register.campaignTypesTitle')}</strong>
            <ul style={{ margin: '8px 0 0', paddingInlineStart: 18 }}>
              {typesPreview.map((ct) => (
                <li key={ct.id}>{String(ct.display_name ?? ct.name ?? ct.id)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="muted" style={{ marginTop: 16 }}>
          {t(language, 'register.hasAccount')}{' '}
          <Link to="/login" className="nav-link" style={{ display: 'inline', padding: 0 }}>
            {t(language, 'register.signIn')}
          </Link>
        </p>
      </article>
    </section>
  )
}
