import { Check, Eye, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccountantReceiptDetailView, KeyValueRecordView } from '../components/StructuredEntityDetails'
import { PromptDialog } from '../components/AppDialog'
import { Modal } from '../components/Modal'
import { ProofThumbWithLightbox } from '../components/ProofThumbWithLightbox'
import { SectionCard } from '../components/SectionCard'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { statusLabel, t } from '../i18n'
import { currency, formatGroupedInt } from '../utils/format'

type WalletRow = { user_id?: number; name?: string; email?: string; balance?: number; currency?: string }

function extractDataArray(res: unknown): Record<string, unknown>[] {
  if (!res || typeof res !== 'object') return []
  const r = res as { data?: unknown }
  if (Array.isArray(r.data)) return r.data as Record<string, unknown>[]
  const inner = r.data as { data?: unknown }
  if (inner && typeof inner === 'object' && Array.isArray(inner.data)) return inner.data as Record<string, unknown>[]
  return []
}

type MetaStoredSummary = {
  days: number
  since: string
  until: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  campaigns_with_data: number
  insight_rows: number
}

function matchesName(q: string, name?: unknown, email?: unknown): boolean {
  const n = String(name ?? '').toLowerCase()
  const e = String(email ?? '').toLowerCase()
  return n.includes(q) || e.includes(q)
}

export function AccountantWorkspacePage() {
  const { language } = useAppContext()
  const [wallets, setWallets] = useState<WalletRow[]>([])
  const [profits, setProfits] = useState<{ total?: number; currency?: string } | null>(null)
  const [receipts, setReceipts] = useState<Record<string, unknown>[]>([])
  const [metaStored, setMetaStored] = useState<MetaStoredSummary | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [topUps, setTopUps] = useState<Record<string, unknown>[]>([])
  const [busyTopUp, setBusyTopUp] = useState<number | null>(null)
  const [searchWallets, setSearchWallets] = useState('')
  const [searchReceipts, setSearchReceipts] = useState('')
  const [searchTopUps, setSearchTopUps] = useState('')
  const [rejectPromptId, setRejectPromptId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const w = await api.get('/accountant/wallets')
      setWallets(extractDataArray(w) as unknown as WalletRow[])
      const p = (await api.get('/accountant/profits')) as { data?: { total?: number; currency?: string } }
      setProfits(p.data ?? null)
      const r = await api.get('/accountant/receipts', { params: statusFilter ? { status: statusFilter } : {} })
      setReceipts(extractDataArray(r))
      const tu = await api.get('/accountant/top-up-requests', { params: { status: 'pending' } })
      setTopUps(extractDataArray(tu))
      try {
        const m = (await api.get('/accountant/meta/stored-insights-summary', { params: { days: 7 } })) as {
          data?: MetaStoredSummary
        }
        setMetaStored(m.data ?? null)
      } catch {
        setMetaStored(null)
      }
    } catch {
      setWallets([])
      setProfits(null)
      setReceipts([])
      setTopUps([])
      setMetaStored(null)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const qW = searchWallets.trim().toLowerCase()
  const qR = searchReceipts.trim().toLowerCase()
  const qT = searchTopUps.trim().toLowerCase()

  const filteredWallets = useMemo(() => {
    const list = wallets.slice(0, 200)
    if (!qW) return list.slice(0, 80)
    return list.filter((w) => matchesName(qW, w.name, w.email)).slice(0, 80)
  }, [wallets, qW])

  const filteredReceipts = useMemo(() => {
    if (!qR) return receipts
    return receipts.filter((r) => matchesName(qR, r.user_name, r.user_email))
  }, [receipts, qR])

  const filteredTopUps = useMemo(() => {
    if (!qT) return topUps
    return topUps.filter((r) => matchesName(qT, r.user_name, r.user_email))
  }, [topUps, qT])

  async function approveTopUp(id: number) {
    setBusyTopUp(id)
    try {
      await api.post(`/accountant/top-up-requests/${id}/approve`)
      await load()
    } finally {
      setBusyTopUp(null)
    }
  }

  function openRejectTopUpPrompt(id: number) {
    setRejectPromptId(id)
  }

  async function submitRejectTopUp(reason: string) {
    const id = rejectPromptId
    if (id == null) return
    setRejectPromptId(null)
    setBusyTopUp(id)
    try {
      await api.post(`/accountant/top-up-requests/${id}/reject`, { reason: reason.trim() || undefined })
      await load()
    } finally {
      setBusyTopUp(null)
    }
  }

  async function openDetail(id: number) {
    setDetailId(id)
    setDetail(null)
    try {
      const res = (await api.get(`/accountant/receipts/${id}`)) as { data?: Record<string, unknown> }
      setDetail(res.data ?? null)
    } catch {
      setDetail(null)
    }
  }

  return (
    <section className="page-grid">
      <div className="page-title page-title--warm">
        <div>
          <h2>
            <span className="page-title__emoji" aria-hidden>
              ✦
            </span>
            {t(language, 'accountantWorkspace.title')}
          </h2>
          <p>{t(language, 'accountantWorkspace.subtitle')}</p>
        </div>
      </div>

      <div className="mini-kpi-grid">
        <div className="mini-kpi">
          <small>{t(language, 'accountantWorkspace.kpiPlatformSpend')}</small>
          <strong>{currency(profits?.total ?? 0)}</strong>
          <small className="muted">{profits?.currency ?? 'USD'}</small>
        </div>
        <div className="mini-kpi">
          <small>{t(language, 'accountantWorkspace.kpiWallets')}</small>
          <strong>{wallets.length}</strong>
        </div>
        <div className="mini-kpi">
          <small>{t(language, 'accountantWorkspace.kpiReceipts')}</small>
          <strong>{receipts.length}</strong>
        </div>
        {metaStored ? (
          <div className="mini-kpi">
            <small>{t(language, 'accountantWorkspace.kpiMetaSpend')}</small>
            <strong>{currency(metaStored.spend)}</strong>
            <small className="muted">
              {metaStored.insight_rows
                ? `${metaStored.campaigns_with_data} ${t(language, 'accountantWorkspace.kpiMetaHint')} · ${formatGroupedInt(metaStored.impressions)}`
                : t(language, 'accountantWorkspace.kpiNoMeta')}
            </small>
          </div>
        ) : null}
      </div>

      <SectionCard title={t(language, 'accountantWorkspace.topUpsTitle')}>
        <input
          type="search"
          className="list-search"
          placeholder={t(language, 'accountantWorkspace.searchTopUps')}
          value={searchTopUps}
          onChange={(e) => setSearchTopUps(e.target.value)}
          aria-label={t(language, 'accountantWorkspace.searchTopUps')}
        />
        {loading ? (
          <p className="muted">{t(language, 'accountantWorkspace.loading')}</p>
        ) : filteredTopUps.length === 0 ? (
          <p className="muted">{t(language, 'accountantWorkspace.topUpsEmpty')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'accountantWorkspace.colId')}</th>
                  <th>{t(language, 'accountantWorkspace.colCustomer')}</th>
                  <th>{t(language, 'accountantWorkspace.colAmount')}</th>
                  <th>{t(language, 'accountantWorkspace.colProof')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredTopUps.map((r) => {
                  const id = Number(r.id)
                  const proof = r.proof_url != null ? String(r.proof_url) : ''
                  return (
                    <tr key={id}>
                      <td>{id}</td>
                      <td>
                        {String(r.user_name ?? '—')}
                        <div className="muted type-caption">{String(r.user_email ?? '')}</div>
                      </td>
                      <td>{currency(Number(r.amount ?? 0))}</td>
                      <td>
                        {proof ? (
                          <ProofThumbWithLightbox proofUrl={proof} viewLabel={t(language, 'accountantWorkspace.viewProof')} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t(language, 'billing.approve')}
                            disabled={busyTopUp === id}
                            onClick={() => void approveTopUp(id)}
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t(language, 'billing.reject')}
                            disabled={busyTopUp === id}
                            onClick={() => openRejectTopUpPrompt(id)}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t(language, 'accountantWorkspace.receiptsTitle')}
        action={
          <div className="filter-grid">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label={t(language, 'accountantWorkspace.colStatus')}
            >
              <option value="">{t(language, 'accountantWorkspace.allStatuses')}</option>
              <option value="pending">{statusLabel(language, 'pending')}</option>
              <option value="approved">{statusLabel(language, 'approved')}</option>
              <option value="rejected">{statusLabel(language, 'rejected')}</option>
            </select>
          </div>
        }
      >
        <p className="muted" style={{ marginBottom: 12 }}>
          {t(language, 'accountantWorkspace.receiptsHint')}
        </p>
        <input
          type="search"
          className="list-search"
          placeholder={t(language, 'accountantWorkspace.searchReceipts')}
          value={searchReceipts}
          onChange={(e) => setSearchReceipts(e.target.value)}
          aria-label={t(language, 'accountantWorkspace.searchReceipts')}
        />
        {loading ? (
          <p className="muted">{t(language, 'accountantWorkspace.loading')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'accountantWorkspace.colId')}</th>
                  <th>{t(language, 'accountantWorkspace.colCustomer')}</th>
                  <th>{t(language, 'accountantWorkspace.colAmount')}</th>
                  <th>{t(language, 'accountantWorkspace.colStatus')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((r) => (
                  <tr key={String(r.id)}>
                    <td>{String(r.id)}</td>
                    <td>{String(r.user_name ?? r.user_email ?? '—')}</td>
                    <td>{currency(Number(r.amount ?? 0))}</td>
                    <td>
                      <span className="pill pill--gray">{statusLabel(language, String(r.status ?? ''))}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t(language, 'tasks.modalDetailTitle')}
                        onClick={() => void openDetail(Number(r.id))}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t(language, 'accountantWorkspace.walletsTitle')}>
        <input
          type="search"
          className="list-search"
          placeholder={t(language, 'accountantWorkspace.searchWallets')}
          value={searchWallets}
          onChange={(e) => setSearchWallets(e.target.value)}
          aria-label={t(language, 'accountantWorkspace.searchWallets')}
        />
        {loading ? (
          <p className="muted">{t(language, 'accountantWorkspace.loading')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'accountantWorkspace.colUser')}</th>
                  <th>{t(language, 'accountantWorkspace.colEmail')}</th>
                  <th>{t(language, 'accountantWorkspace.colBalance')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredWallets.map((w) => (
                  <tr key={String(w.user_id)}>
                    <td>{String(w.name ?? '—')}</td>
                    <td className="muted">{String(w.email ?? '—')}</td>
                    <td>
                      {currency(Number(w.balance ?? 0))} {w.currency ? String(w.currency) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        title={`${t(language, 'accountantWorkspace.receiptModal')} #${detailId ?? ''}`}
        open={detailId != null}
        onClose={() => {
          setDetailId(null)
          setDetail(null)
        }}
      >
        {detail ? (
          <>
            <AccountantReceiptDetailView data={detail} />
            <details className="muted" style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer' }}>{t(language, 'accountantWorkspace.allFieldsSummary')}</summary>
              <div style={{ marginTop: 8 }}>
                <KeyValueRecordView data={detail} />
              </div>
            </details>
          </>
        ) : (
          <p className="muted">{t(language, 'accountantWorkspace.loading')}</p>
        )}
      </Modal>

      <PromptDialog
        open={rejectPromptId != null}
        title={t(language, 'billing.reject')}
        label={t(language, 'accountantWorkspace.rejectPrompt')}
        multiline
        initialValue=""
        confirmLabel={t(language, 'billing.reject')}
        cancelLabel={t(language, 'users.cancel')}
        onSubmit={(v) => void submitRejectTopUp(v)}
        onCancel={() => setRejectPromptId(null)}
      />
    </section>
  )
}
