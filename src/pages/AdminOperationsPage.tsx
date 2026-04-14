import { Activity, Bell, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ProofThumbWithLightbox } from '../components/ProofThumbWithLightbox'
import { SectionCard } from '../components/SectionCard'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { currency } from '../utils/format'
import { t } from '../i18n'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type LinkRow = { id: number; name: string; customer?: { name?: string; email?: string }; created_at?: string }
type AdAccLinkRow = {
  id: number
  name: string
  meta_ad_account_id?: string
  customer?: { name?: string; email?: string }
  created_at?: string
}
type TopRow = { id: number; amount: number; user?: { name?: string; email?: string }; proof_url?: string | null; created_at?: string }
type UserRow = { id: number; name?: string; email?: string; last_login_at?: string | null }
type LowRow = { user_id: number; name?: string; email?: string; balance: number }

export function AdminOperationsPage() {
  const { language } = useAppContext()
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [pendingLinking, setPendingLinking] = useState<LinkRow[]>([])
  const [pendingAdAccountLinking, setPendingAdAccountLinking] = useState<AdAccLinkRow[]>([])
  const [pendingTopUps, setPendingTopUps] = useState<TopRow[]>([])
  const [inactive, setInactive] = useState<UserRow[]>([])
  const [lowBal, setLowBal] = useState<LowRow[]>([])
  const [byStatus, setByStatus] = useState<{ name: string; value: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setMsg(null)
    try {
      /** Axios interceptor returns JSON body: fields are top-level, not under `data`. */
      const res = (await api.get('/admin/operations/pulse', { params: { inactive_days: days } })) as {
        pending_linking?: LinkRow[]
        pending_ad_account_linking?: AdAccLinkRow[]
        pending_top_ups?: TopRow[]
        inactive_users?: UserRow[]
        low_balance_users?: LowRow[]
        campaigns_by_status?: Record<string, number>
      }
      const d = res
      setPendingLinking(Array.isArray(d.pending_linking) ? d.pending_linking : [])
      setPendingAdAccountLinking(Array.isArray(d.pending_ad_account_linking) ? d.pending_ad_account_linking : [])
      setPendingTopUps(Array.isArray(d.pending_top_ups) ? d.pending_top_ups : [])
      setInactive(Array.isArray(d.inactive_users) ? d.inactive_users : [])
      setLowBal(Array.isArray(d.low_balance_users) ? d.low_balance_users : [])
      const raw = d.campaigns_by_status && typeof d.campaigns_by_status === 'object' ? d.campaigns_by_status : {}
      setByStatus(
        Object.entries(raw).map(([name, value]) => ({
          name,
          value: Number(value),
        })),
      )
    } catch (e) {
      setMsg(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to load')
      setPendingLinking([])
      setPendingAdAccountLinking([])
      setPendingTopUps([])
      setInactive([])
      setLowBal([])
      setByStatus([])
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  async function notifyInactive() {
    setBusy(true)
    setMsg(null)
    try {
      await api.post('/admin/system/notify-inactive', { inactive_days: days })
      setMsg(t(language, 'adminPulse.notifyOk'))
    } catch (e) {
      setMsg(
        e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : t(language, 'adminPulse.notifyFail'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="page-grid">
      <div className="page-title page-title--row">
        <div>
          <h2>{t(language, 'adminPulse.title')}</h2>
          <p>{t(language, 'adminPulse.subtitle')}</p>
        </div>
        <span className="pill pill--violet" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Activity size={14} /> Super admin
        </span>
      </div>

      <div className="filter-grid filter-grid--users" style={{ marginBottom: 8, alignItems: 'center' }}>
        <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t(language, 'adminPulse.inactiveDays')}
          <input
            type="number"
            min={7}
            max={365}
            value={days}
            onChange={(e) => setDays(Math.max(7, Number(e.target.value) || 30))}
            style={{ width: 72 }}
          />
        </label>
        <button type="button" className="ghost-btn" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={16} /> {t(language, 'adminPulse.refresh')}
        </button>
        <button type="button" className="primary-btn" disabled={busy || loading} onClick={() => void notifyInactive()}>
          <Bell size={16} /> {t(language, 'adminPulse.notifyAdmins')}
        </button>
      </div>
      {msg ? <p className="login-error">{msg}</p> : null}

      {byStatus.length > 0 ? (
        <SectionCard title={t(language, 'adminPulse.campaignsByStatus')}>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={byStatus} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Campaigns" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      ) : null}

      <div className="two-col-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <SectionCard title={t(language, 'adminPulse.pendingLinking')}>
          {loading ? (
            <p className="muted">…</p>
          ) : pendingLinking.length === 0 ? (
            <p className="muted">{t(language, 'common.emptyList')}</p>
          ) : (
            <ul className="plain-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {pendingLinking.map((c) => (
                <li key={c.id} className="card-li" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong>{c.name}</strong>
                  <div className="muted type-caption">
                    {c.customer?.name} · {c.customer?.email}
                  </div>
                  <div className="type-caption muted">{c.created_at}</div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t(language, 'adminPulse.pendingAdAccountLinking')}>
          {loading ? (
            <p className="muted">…</p>
          ) : pendingAdAccountLinking.length === 0 ? (
            <p className="muted">{t(language, 'common.emptyList')}</p>
          ) : (
            <ul className="plain-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {pendingAdAccountLinking.map((a) => (
                <li key={a.id} className="card-li" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong>{a.name}</strong>
                  <div className="muted type-caption">{a.meta_ad_account_id}</div>
                  <div className="muted type-caption">
                    {a.customer?.name} · {a.customer?.email}
                  </div>
                  <div className="type-caption muted">{a.created_at}</div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t(language, 'adminPulse.pendingTopUps')}>
          {loading ? (
            <p className="muted">…</p>
          ) : pendingTopUps.length === 0 ? (
            <p className="muted">{t(language, 'common.emptyList')}</p>
          ) : (
            <ul className="plain-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {pendingTopUps.map((c) => (
                <li key={c.id} className="card-li" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong>{currency(c.amount)}</strong>
                  <div className="muted type-caption">
                    {c.user?.name} · {c.user?.email}
                  </div>
                  {c.proof_url ? (
                    <div style={{ marginTop: 8 }}>
                      <ProofThumbWithLightbox proofUrl={String(c.proof_url)} viewLabel={t(language, 'tasks.detailProof')} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t(language, 'adminPulse.inactiveUsers')}>
          {loading ? (
            <p className="muted">…</p>
          ) : inactive.length === 0 ? (
            <p className="muted">{t(language, 'common.emptyList')}</p>
          ) : (
            <ul className="plain-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {inactive.slice(0, 25).map((c) => (
                <li key={c.id} className="card-li" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong>{c.name}</strong>
                  <div className="muted type-caption">{c.email}</div>
                  <div className="type-caption muted">
                    {t(language, 'users.lastLogin')}: {c.last_login_at ?? '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t(language, 'adminPulse.lowBalance')}>
          {loading ? (
            <p className="muted">…</p>
          ) : lowBal.length === 0 ? (
            <p className="muted">{t(language, 'common.emptyList')}</p>
          ) : (
            <ul className="plain-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {lowBal.slice(0, 25).map((c) => (
                <li key={c.user_id} className="card-li" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <strong>{c.name}</strong>
                  <div className="muted type-caption">{c.email}</div>
                  <div className="type-caption">{currency(c.balance)}</div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </section>
  )
}
