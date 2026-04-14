import { Bell, BellRing, ShieldAlert, Trash2, TriangleAlert, CheckCheck, Check } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { TableSkeletonRows } from '../components/Skeleton'
import { ConfirmDialog } from '../components/AppDialog'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { formatNotificationForDisplay } from '../lib/notificationDisplay'
import { t } from '../i18n'
import { relativeFromIso } from '../utils/time'

type Item = { id: string; title: string; body: string; read: boolean; created_at: string; type: string }

export function NotificationsPage() {
  const { language, refreshInbox } = useAppContext()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | 'all' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg(null)
    try {
      const res = (await api.get('/notifications')) as {
        data?: { data?: Item[] }
      }
      const inner = res?.data?.data
      setItems(Array.isArray(inner) ? inner : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
      void refreshInbox()
    }
  }, [refreshInbox])

  useEffect(() => {
    void load()
  }, [load])

  async function markAllRead() {
    setBusy('all')
    setMsg(null)
    try {
      await api.put('/notifications/read-all')
      await load()
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function markRead(id: string) {
    setBusy(id)
    setMsg(null)
    try {
      await api.put(`/notifications/${id}/read`)
      await load()
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  function requestRemove(id: string) {
    setPendingDeleteId(id)
  }

  async function confirmRemoveNotification() {
    const id = pendingDeleteId
    if (!id) return
    setPendingDeleteId(null)
    setBusy(id)
    setMsg(null)
    try {
      await api.delete(`/notifications/${id}`)
      await load()
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  function severityFor(n: Item): 'critical' | 'warning' | 'info' {
    const ty = n.type.toLowerCase()
    if (ty.includes('reject') || ty.includes('fail') || ty.includes('suspended')) return 'critical'
    if (ty.includes('pending') || ty.includes('receipt') || ty.includes('approval') || ty.includes('task')) return 'warning'
    return 'info'
  }

  return (
    <section className="page-grid">
      <div className="page-title">
        <h2>{t(language, 'notifications.center')}</h2>
        <p>{t(language, 'notifications.subtitle')}</p>
      </div>

      <section className="section-card">
        <div className="notifications-card__head">
          <h3>{t(language, 'notifications.inboxTitle')}</h3>
          <button
            type="button"
            className="ghost-btn"
            disabled={busy === 'all' || items.length === 0}
            title={items.length === 0 ? undefined : t(language, 'notifications.markAllRead')}
            onClick={() => void markAllRead()}
          >
            <CheckCheck size={16} /> {t(language, 'notifications.markAllRead')}
          </button>
        </div>
        {msg ? <p className="login-error" style={{ marginBottom: 12 }}>{msg}</p> : null}
        {loading ? (
          <TableSkeletonRows rows={4} cols={1} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t(language, 'notifications.emptyTitle')}
            description={t(language, 'notifications.emptyDesc')}
          />
        ) : (
          <div className="notification-list" dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {items.map((item) => {
              const sev = severityFor(item)
              const Icon = sev === 'critical' ? ShieldAlert : sev === 'warning' ? TriangleAlert : BellRing
              const { title: displayTitle, body: displayBody } = formatNotificationForDisplay(language, item)
              return (
                <article key={item.id} className={`notification notification--${sev}`}>
                  <span className="notification__icon">
                    <Icon size={16} />
                  </span>
                  <div className="notification__body">
                    <h4>{displayTitle}</h4>
                    {displayBody ? <p>{displayBody}</p> : null}
                  </div>
                  <small className="notification__time">{relativeFromIso(language, item.created_at)}</small>
                  <div className="row-actions notification__actions" style={{ flexShrink: 0 }}>
                    {!item.read ? (
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={busy === item.id}
                        aria-label={t(language, 'notifications.markReadAria')}
                        title={t(language, 'notifications.markReadAria')}
                        onClick={() => void markRead(item.id)}
                      >
                        <Check size={15} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={busy === item.id}
                      aria-label={t(language, 'notifications.deleteAria')}
                      title={t(language, 'notifications.deleteAria')}
                      onClick={() => requestRemove(item.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingDeleteId != null}
        title={t(language, 'notifications.center')}
        message={t(language, 'notifications.deleteConfirm')}
        confirmLabel={t(language, 'dialog.delete')}
        cancelLabel={t(language, 'users.cancel')}
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void confirmRemoveNotification()}
      />
    </section>
  )
}
