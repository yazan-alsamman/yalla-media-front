import { UserPlus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { SectionCard } from '../components/SectionCard'
import { HelpHint } from '../components/HelpHint'
import { SkeletonLine } from '../components/Skeleton'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { t } from '../i18n'

type Row = {
  id: number
  full_name: string
  whatsapp: string
  source?: string
  created_by_name?: string | null
  status: string
  user_id?: number | null
  reject_reason?: string | null
  created_at?: string
}

export function AccountRequestsPage() {
  const { language, role } = useAppContext()
  const isSuperAdmin = role === 'super_admin'
  /** المدير ينشئ الحساب من الطلب؛ المشرف العام يسجّل الطلب فقط. */
  const canProcessRequests = role === 'admin'
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [emailById, setEmailById] = useState<Record<number, string>>({})
  const [passwordById, setPasswordById] = useState<Record<number, string>>({})
  const [rejectOpen, setRejectOpen] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [newName, setNewName] = useState('')
  const [newWhatsapp, setNewWhatsapp] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [addMessage, setAddMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.get('/admin/account-requests')) as { data?: Row[] }
      setRows(Array.isArray(res.data) ? res.data : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function accept(id: number) {
    const email = (emailById[id] ?? '').trim()
    const password = passwordById[id] ?? ''
    if (!email || !password) return
    setBusy(id)
    try {
      await api.post(`/admin/account-requests/${id}/accept`, { email, password })
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function reject(id: number) {
    setBusy(id)
    try {
      await api.post(`/admin/account-requests/${id}/reject`, { reason: rejectReason.trim() || undefined })
      setRejectOpen(null)
      setRejectReason('')
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function submitSuperAdminRequest() {
    const name = newName.trim()
    const wa = newWhatsapp.trim()
    if (!name || !wa) return
    setAddBusy(true)
    setAddMessage(null)
    try {
      await api.post('/admin/account-requests', { full_name: name, whatsapp: wa })
      setNewName('')
      setNewWhatsapp('')
      setAddMessage({ ok: true, text: t(language, 'accountRequests.addSuccess') })
      await load()
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : ''
      setAddMessage({ ok: false, text: msg || t(language, 'accountRequests.addError') })
    } finally {
      setAddBusy(false)
    }
  }

  function sourceLabel(src: string | undefined) {
    const s = (src ?? 'app').toLowerCase()
    if (s === 'dashboard') return t(language, 'accountRequests.sourceDashboard')
    return t(language, 'accountRequests.sourceApp')
  }

  return (
    <section className="page-grid">
      <div className="page-title">
        <h2>{t(language, 'accountRequests.title')}</h2>
        <p>{t(language, 'accountRequests.subtitle')}</p>
      </div>

      <HelpHint
        language={language}
        titleKey="accountRequests.helpTitle"
        whatKey="accountRequests.helpWhat"
        whyKey="accountRequests.helpWhy"
        howKey="accountRequests.helpHow"
      />

      {isSuperAdmin ? (
        <SectionCard
          title={t(language, 'accountRequests.addSectionTitle')}
          description={t(language, 'accountRequests.addSectionHint')}
          icon={UserPlus}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
            <div>
              <label className="type-caption muted" style={{ display: 'block', marginBottom: 6 }}>
                {t(language, 'accountRequests.fullName')}
              </label>
              <input
                className="modal-textarea"
                style={{ width: '100%', minHeight: 42 }}
                type="text"
                autoComplete="off"
                placeholder={t(language, 'accountRequests.fullNamePlaceholder')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <p className="muted type-caption" style={{ marginTop: 6, marginBottom: 0 }}>
                {t(language, 'accountRequests.hintFullName')}
              </p>
            </div>
            <div>
              <label className="type-caption muted" style={{ display: 'block', marginBottom: 6 }}>
                {t(language, 'accountRequests.whatsapp')}
              </label>
              <input
                className="modal-textarea"
                style={{ width: '100%', minHeight: 42 }}
                type="text"
                autoComplete="off"
                placeholder={t(language, 'accountRequests.whatsappPlaceholder')}
                value={newWhatsapp}
                onChange={(e) => setNewWhatsapp(e.target.value)}
              />
              <p className="muted type-caption" style={{ marginTop: 6, marginBottom: 0 }}>
                {t(language, 'accountRequests.hintWhatsapp')}
              </p>
            </div>
            {addMessage ? (
              <p className={addMessage.ok ? 'pill pill--green' : 'pill pill--gray'} style={{ padding: '8px 12px' }}>
                {addMessage.text}
              </p>
            ) : null}
            <div>
              <button
                type="button"
                className="primary-btn"
                disabled={addBusy || !newName.trim() || !newWhatsapp.trim()}
                onClick={() => void submitSuperAdminRequest()}
              >
                {t(language, 'accountRequests.addSubmit')}
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={t(language, 'accountRequests.listTitle')} description={t(language, 'accountRequests.listHint')} icon={UserPlus}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonLine key={i} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state--soft">
            <EmptyState icon={UserPlus} title={t(language, 'accountRequests.empty')} description="" />
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'accountRequests.fullName')}</th>
                  <th>{t(language, 'accountRequests.whatsapp')}</th>
                  <th>{t(language, 'accountRequests.source')}</th>
                  <th>{t(language, 'users.status')}</th>
                  <th>{canProcessRequests ? t(language, 'accountRequests.accept') : t(language, 'accountRequests.actionsColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.status !== 'pending' ? 'row-muted' : undefined}>
                    <td>{r.full_name}</td>
                    <td>{r.whatsapp}</td>
                    <td>
                      <span className="pill pill--gray">{sourceLabel(r.source)}</span>
                      {r.created_by_name ? (
                        <div className="muted type-caption" style={{ marginTop: 4 }}>
                          {t(language, 'accountRequests.addedBy')}: {r.created_by_name}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className="pill pill--gray">{r.status}</span>
                      {r.user_id ? (
                        <span className="pill pill--green" style={{ marginInlineStart: 8 }}>
                          #{r.user_id}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {r.status === 'pending' && !canProcessRequests ? (
                        <span className="muted type-caption">{t(language, 'accountRequests.superAdminWaitAdmin')}</span>
                      ) : r.status === 'pending' && canProcessRequests ? (
                        <div className="row-actions" style={{ flexWrap: 'wrap', gap: 8, maxWidth: 440 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
                            <input
                              className="modal-textarea"
                              style={{ maxWidth: 200, minHeight: 36 }}
                              type="email"
                              autoComplete="off"
                              placeholder={t(language, 'accountRequests.email')}
                              value={emailById[r.id] ?? ''}
                              onChange={(e) => setEmailById((m) => ({ ...m, [r.id]: e.target.value }))}
                            />
                            <span className="muted type-caption">{t(language, 'accountRequests.hintEmail')}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
                            <input
                              className="modal-textarea"
                              style={{ maxWidth: 180, minHeight: 36 }}
                              type="password"
                              autoComplete="new-password"
                              placeholder={t(language, 'accountRequests.password')}
                              value={passwordById[r.id] ?? ''}
                              onChange={(e) => setPasswordById((m) => ({ ...m, [r.id]: e.target.value }))}
                            />
                            <span className="muted type-caption">{t(language, 'accountRequests.hintPassword')}</span>
                          </div>
                          <button
                            type="button"
                            className="primary-btn"
                            disabled={busy === r.id}
                            onClick={() => void accept(r.id)}
                          >
                            {t(language, 'accountRequests.accept')}
                          </button>
                          <button
                            type="button"
                            className="ghost-btn"
                            disabled={busy === r.id}
                            onClick={() => {
                              setRejectOpen(r.id)
                              setRejectReason('')
                            }}
                          >
                            {t(language, 'accountRequests.reject')}
                          </button>
                        </div>
                      ) : r.status === 'rejected' && r.reject_reason ? (
                        <span className="muted type-caption">{r.reject_reason}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {rejectOpen != null ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setRejectOpen(null)}>
          <div className="modal-panel" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="modal-panel__head">
              <h2>{t(language, 'accountRequests.reject')}</h2>
            </div>
            <div className="modal-panel__body">
              <textarea
                className="modal-textarea"
                rows={3}
                placeholder={t(language, 'accountRequests.rejectReason')}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="modal-panel__foot" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="ghost-btn" onClick={() => setRejectOpen(null)}>
                {t(language, 'users.cancel')}
              </button>
              <button type="button" className="primary-btn" disabled={busy === rejectOpen} onClick={() => void reject(rejectOpen)}>
                {t(language, 'accountRequests.reject')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
