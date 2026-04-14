import { Eye, EyeOff, Moon, SunMedium } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { publicUrl } from '../lib/publicUrl'
import { t } from '../i18n'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, theme, setTheme, language, authReady, isAuthenticated } = useAppContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (authReady && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [authReady, isAuthenticated, navigate])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      navigate('/dashboard')
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : t(language, 'login.errorGeneric')
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="login-page">
      <article className="login-card">
        <div className="login-head">
          <div className="login-brand">
            <img src={publicUrl('logo.png')} alt="" className="login-brand__logo" width={52} height={52} />
            <div className="login-brand__text">
              <h1 className="login-brand__title">{t(language, 'brand.name')}</h1>
              <p className="login-brand__subtitle">{t(language, 'login.subtitle')}</p>
            </div>
          </div>
          <div className="login-head__controls">
            <button
              className="icon-btn icon-btn--plain"
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? t(language, 'common.light') : t(language, 'common.dark')}
            >
              {theme === 'dark' ? <SunMedium size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>

        <p className="login-admin-hint muted" style={{ marginTop: 12, marginBottom: 0, lineHeight: 1.55, fontSize: 14 }}>
          {t(language, 'login.noSelfSignup')}
        </p>

        <form onSubmit={handleLogin} className="login-form">
          <label>
            <span>{t(language, 'login.email')}</span>
            <input
              type="email"
              autoComplete="email"
              placeholder={t(language, 'login.emailPlaceholder')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            <span>{t(language, 'login.password')}</span>
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t(language, 'login.passwordPlaceholder')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="password-field__toggle icon-btn icon-btn--plain"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t(language, 'login.hidePassword') : t(language, 'login.showPassword')}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error ? <p className="login-error">{error}</p> : null}

          <button className="primary-btn login-form__submit" type="submit" disabled={submitting}>
            {submitting ? '…' : t(language, 'login.signIn')}
          </button>
        </form>
      </article>
    </section>
  )
}
