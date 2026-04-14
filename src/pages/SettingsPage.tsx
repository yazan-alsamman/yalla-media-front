import { LockKeyhole, UserCog } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SectionCard } from '../components/SectionCard'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { roleLabel, t } from '../i18n'

export function SettingsPage() {
  const { role, language, theme, setTheme, currentUser, refreshCurrentUser } = useAppContext()
  const isAdmin = role === 'admin' || role === 'super_admin'

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [profileBusy, setProfileBusy] = useState(false)

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  const [fcmToken, setFcmToken] = useState('')
  const [fcmMsg, setFcmMsg] = useState<string | null>(null)
  const [fcmBusy, setFcmBusy] = useState(false)

  const [platformSettings, setPlatformSettings] = useState<unknown>(null)
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null)
  const [settingsBusy, setSettingsBusy] = useState(false)

  useEffect(() => {
    setName(currentUser?.name ?? '')
    setPhone(currentUser?.phone ?? '')
  }, [currentUser])

  useEffect(() => {
    if (!isAdmin) return
    void (async () => {
      try {
        const res = (await api.get('/admin/settings')) as { data?: unknown }
        setPlatformSettings(res.data ?? {})
      } catch {
        setPlatformSettings(null)
      }
    })()
  }, [isAdmin])

  async function saveProfile() {
    setProfileBusy(true)
    setProfileMsg(null)
    try {
      await api.put('/auth/profile', {
        name: name.trim(),
        phone: phone.trim() || null,
        language: 'ar',
        theme,
      })
      await refreshCurrentUser()
      setProfileMsg(t(language, 'settings.profileSaved'))
    } catch (e: unknown) {
      setProfileMsg(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : t(language, 'settings.saveFailed'),
      )
    } finally {
      setProfileBusy(false)
    }
  }

  async function changePassword() {
    setPwBusy(true)
    setPwMsg(null)
    if (newPw !== confirmPw) {
      setPwMsg(t(language, 'settings.passwordMismatch'))
      setPwBusy(false)
      return
    }
    try {
      await api.post('/auth/change-password', {
        current_password: curPw,
        password: newPw,
        password_confirmation: confirmPw,
      })
      setCurPw('')
      setNewPw('')
      setConfirmPw('')
      setPwMsg(t(language, 'settings.passwordUpdated'))
    } catch (e: unknown) {
      setPwMsg(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : t(language, 'settings.saveFailed'),
      )
    } finally {
      setPwBusy(false)
    }
  }

  async function saveFcm() {
    setFcmBusy(true)
    setFcmMsg(null)
    try {
      await api.put('/auth/fcm-token', { fcm_token: fcmToken.trim() || null })
      setFcmMsg(t(language, 'settings.fcmSaved'))
    } catch (e: unknown) {
      setFcmMsg(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : t(language, 'settings.saveFailed'),
      )
    } finally {
      setFcmBusy(false)
    }
  }

  async function refreshAdminSettings() {
    setSettingsBusy(true)
    setSettingsMsg(null)
    try {
      const res = (await api.get('/admin/settings')) as { data?: unknown }
      setPlatformSettings(res.data ?? {})
      setSettingsMsg(t(language, 'settings.payloadReloaded'))
    } catch (e: unknown) {
      setSettingsMsg(
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : t(language, 'settings.saveFailed'),
      )
    } finally {
      setSettingsBusy(false)
    }
  }


  return (
    <section className="page-grid">
      <div className="page-title">
        <h2>{t(language, 'settings.pageTitle')}</h2>
        <p>{t(language, 'settings.pageSubtitle')}</p>
      </div>

      <SectionCard title={t(language, 'settings.profileSettings')} description={t(language, 'settings.profileDesc')}>
        <div className="settings-grid">
          <label>
            <span>{t(language, 'settings.fullName')}</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'settings.email')}</span>
            <input type="email" value={currentUser?.email ?? ''} readOnly className="input-readonly" />
          </label>
          <label>
            <span>{t(language, 'settings.phone')}</span>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'settings.currentRole')}</span>
            <input
              type="text"
              value={roleLabel(language, role, currentUser?.employee_type)}
              readOnly
              className="input-readonly"
            />
          </label>
          <label>
            <span>{t(language, 'settings.language')}</span>
            <input type="text" readOnly className="input-readonly" value={t(language, 'settings.languageArabicOnly')} />
          </label>
          <label>
            <span>{t(language, 'settings.appMode')}</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value as 'light' | 'dark')}>
              <option value="light">{t(language, 'common.light')}</option>
              <option value="dark">{t(language, 'common.dark')}</option>
            </select>
          </label>
        </div>
        {profileMsg ? <p className="muted" style={{ marginTop: 8 }}>{profileMsg}</p> : null}
        <div className="row-actions">
          <button type="button" className="primary-btn" disabled={profileBusy} onClick={() => void saveProfile()}>
            <UserCog size={16} /> {profileBusy ? '…' : t(language, 'common.save')}
          </button>
        </div>
      </SectionCard>

      <details className="advanced-details">
        <summary>{t(language, 'settings.advancedToggle')}</summary>
        <SectionCard title={t(language, 'settings.pushTitle')} description={t(language, 'settings.pushDesc')}>
          <label>
            <span className="type-caption">{t(language, 'settings.fcmDeviceToken')}</span>
            <input
              type="text"
              value={fcmToken}
              onChange={(e) => setFcmToken(e.target.value)}
              placeholder={t(language, 'settings.fcmPlaceholder')}
            />
          </label>
          {fcmMsg ? <p className="muted" style={{ marginTop: 8 }}>{fcmMsg}</p> : null}
          <div className="row-actions" style={{ marginTop: 12 }}>
            <button type="button" className="primary-btn" disabled={fcmBusy} onClick={() => void saveFcm()}>
              {fcmBusy ? '…' : t(language, 'settings.fcmSaveToken')}
            </button>
          </div>
        </SectionCard>

        {isAdmin ? (
          <SectionCard title={t(language, 'settings.platformAdminTitle')} description={t(language, 'settings.platformAdminDesc')}>
            <pre className="type-caption" style={{ fontSize: 11, overflow: 'auto', maxHeight: 200, margin: 0, padding: 12, borderRadius: 8, background: 'var(--surface-muted)' }}>
              {JSON.stringify(platformSettings ?? {}, null, 2)}
            </pre>
            {settingsMsg ? <p className="muted" style={{ marginTop: 8 }}>{settingsMsg}</p> : null}
            <div className="row-actions" style={{ marginTop: 12 }}>
              <button type="button" className="ghost-btn" disabled={settingsBusy} onClick={() => void refreshAdminSettings()}>
                {settingsBusy ? '…' : t(language, 'settings.reloadPayload')}
              </button>
            </div>
          </SectionCard>
        ) : null}
      </details>

      <SectionCard title={t(language, 'settings.security')} description={t(language, 'settings.securityDesc')}>
        <div className="settings-grid">
          <label>
            <span>{t(language, 'settings.currentPassword')}</span>
            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
          </label>
          <label>
            <span>{t(language, 'settings.newPassword')}</span>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </label>
          <label>
            <span>{t(language, 'settings.confirmPassword')}</span>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        {pwMsg ? <p className="muted" style={{ marginTop: 8 }}>{pwMsg}</p> : null}
        <button type="button" className="ghost-btn" disabled={pwBusy} onClick={() => void changePassword()}>
          <LockKeyhole size={16} /> {pwBusy ? '…' : t(language, 'common.updatePassword')}
        </button>
      </SectionCard>
    </section>
  )
}
