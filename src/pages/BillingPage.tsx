import { Plus, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { TableSkeletonRows } from '../components/Skeleton'
import { SectionCard } from '../components/SectionCard'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { statusLabel, t } from '../i18n'
import { currency } from '../utils/format'

type BillingTab = 'transactions' | 'receipts' | 'all_receipts'

interface PendingCredit {
  id: number
  user_id: number
  user_name?: string
  user_email?: string
  amount: number
  description?: string
  created_at?: string
}

interface ReceiptRow {
  id: number
  receipt_number?: string
  user_name?: string
  user_email?: string
  amount: number
  status: string
  created_at?: string
}

export function BillingPage() {
  const { role, language } = useAppContext()
  const isCustomer = role === 'customer'
  const canDirectTopUp = role === 'super_admin' || role === 'admin'
  const canApproveCredits = role === 'super_admin' || role === 'admin' || role === 'accountant'
  const canViewLedger = role === 'super_admin' || role === 'admin' || role === 'accountant'
  const canApproveReceipts = role === 'super_admin' || role === 'admin'
  const canReviewReceiptsAsAccountant = role === 'accountant'
  const receiptActions = canApproveReceipts || canReviewReceiptsAsAccountant

  const [wallet, setWallet] = useState<{
    balance: number
    pending_balance: number
    spending_this_month: number
  } | null>(null)
  const [transactions, setTransactions] = useState<Record<string, unknown>[]>([])
  const [customerReceiptsPending, setCustomerReceiptsPending] = useState(0)
  const [customerReceiptList, setCustomerReceiptList] = useState<{ id: number; receipt_number?: string; amount: number; status: string; created_at?: string }[]>([])
  const [loading, setLoading] = useState(isCustomer)

  const [tab, setTab] = useState<BillingTab>('transactions')
  const [pendingCredits, setPendingCredits] = useState<PendingCredit[]>([])
  const [staffTransactions, setStaffTransactions] = useState<Record<string, unknown>[]>([])
  const [receiptRows, setReceiptRows] = useState<ReceiptRow[]>([])
  const [adminAllReceipts, setAdminAllReceipts] = useState<ReceiptRow[]>([])
  const [staffLoading, setStaffLoading] = useState(false)

  const [topUpOpen, setTopUpOpen] = useState(false)
  const [topUpUserId, setTopUpUserId] = useState('')
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpNote, setTopUpNote] = useState('')
  const [customerOptions, setCustomerOptions] = useState<{ id: number; label: string }[]>([])
  const [actionBusy, setActionBusy] = useState(false)

  const [requestOpen, setRequestOpen] = useState(false)
  const [reqAmount, setReqAmount] = useState('')
  const [reqNotes, setReqNotes] = useState('')

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadAmount, setUploadAmount] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectKind, setRejectKind] = useState<'credit' | 'receipt'>('credit')
  const [creditListSearch, setCreditListSearch] = useState('')
  const [staffReceiptSearch, setStaffReceiptSearch] = useState('')
  const [archiveReceiptSearch, setArchiveReceiptSearch] = useState('')

  const loadCustomer = useCallback(async () => {
    setLoading(true)
    try {
      const w = (await api.get('/customer/wallet')) as {
        data?: { balance: number; pending_balance: number; spending_this_month: number }
      }
      const tx = (await api.get('/customer/wallet/transactions')) as { data?: Record<string, unknown>[] }
      const rc = (await api.get('/customer/receipts')) as {
        data?: { id: number; receipt_number?: string; amount: number; status: string; created_at?: string }[]
      }
      setWallet(w.data ?? null)
      setTransactions(Array.isArray(tx.data) ? tx.data : [])
      const rlist = Array.isArray(rc.data) ? rc.data : []
      setCustomerReceiptList(rlist)
      setCustomerReceiptsPending(rlist.filter((x) => x.status === 'pending').length)
    } catch {
      setWallet(null)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStaff = useCallback(async () => {
    if (!canViewLedger) return
    setStaffLoading(true)
    try {
      try {
        const txRes = (await api.get('/accountant/transactions')) as { data?: Record<string, unknown>[] }
        setStaffTransactions(Array.isArray(txRes.data) ? txRes.data : [])
      } catch {
        setStaffTransactions([])
      }

      if (canApproveCredits) {
        try {
          const path = role === 'accountant' ? '/accountant/wallet/pending-requests' : '/admin/wallets/pending-requests'
          const pr = (await api.get(path)) as { data?: PendingCredit[] }
          setPendingCredits(Array.isArray(pr.data) ? pr.data : [])
        } catch {
          setPendingCredits([])
        }
      } else {
        setPendingCredits([])
      }

      try {
        let receipts: ReceiptRow[] = []
        if (canApproveReceipts) {
          const r = (await api.get('/admin/receipts/pending')) as { data?: ReceiptRow[] }
          receipts = Array.isArray(r.data) ? r.data : []
        } else if (canReviewReceiptsAsAccountant) {
          const r = (await api.get('/accountant/receipts', { params: { status: 'pending' } })) as { data?: ReceiptRow[] }
          receipts = Array.isArray(r.data) ? r.data : []
        }
        setReceiptRows(receipts)
      } catch {
        setReceiptRows([])
      }

      if (canDirectTopUp) {
        try {
          const users = (await api.get('/admin/users', { params: { segment: 'customers', per_page: 100 } })) as {
            data?: { id: number; name: string; email: string }[]
          }
          const list = users.data ?? []
          setCustomerOptions(list.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` })))
        } catch {
          setCustomerOptions([])
        }
      }

      if (canApproveReceipts) {
        try {
          const all = (await api.get('/admin/receipts')) as { data?: ReceiptRow[] }
          setAdminAllReceipts(Array.isArray(all.data) ? all.data : [])
        } catch {
          setAdminAllReceipts([])
        }
      } else {
        setAdminAllReceipts([])
      }
    } finally {
      setStaffLoading(false)
    }
  }, [canViewLedger, canApproveCredits, canApproveReceipts, canDirectTopUp, canReviewReceiptsAsAccountant, role])

  useEffect(() => {
    if (isCustomer) void loadCustomer()
    else void loadStaff()
  }, [isCustomer, loadCustomer, loadStaff])

  async function submitTopUp() {
    const uid = Number(topUpUserId)
    const amt = Number(topUpAmount)
    if (!uid || !amt) return
    setActionBusy(true)
    try {
      await api.post('/admin/wallets/top-up', {
        user_id: uid,
        amount: amt,
        description: topUpNote.trim() || undefined,
      })
      setTopUpOpen(false)
      setTopUpAmount('')
      setTopUpNote('')
      await loadStaff()
    } finally {
      setActionBusy(false)
    }
  }

  async function approveCredit(id: number) {
    setActionBusy(true)
    try {
      const base =
        role === 'accountant' ? '/accountant/wallet/pending-requests' : '/admin/wallets/pending-requests'
      await api.post(`${base}/${id}/approve`)
      await loadStaff()
    } finally {
      setActionBusy(false)
    }
  }

  async function submitReject() {
    if (rejectId == null) return
    setActionBusy(true)
    try {
      if (rejectKind === 'credit') {
        const base =
          role === 'accountant' ? '/accountant/wallet/pending-requests' : '/admin/wallets/pending-requests'
        await api.post(`${base}/${rejectId}/reject`, { reason: rejectReason })
      } else {
        const base = role === 'accountant' ? '/accountant/receipts' : '/admin/receipts'
        await api.post(`${base}/${rejectId}/reject`, { reason: rejectReason })
      }
      setRejectOpen(false)
      setRejectId(null)
      setRejectReason('')
      await loadStaff()
    } finally {
      setActionBusy(false)
    }
  }

  async function approveReceipt(id: number) {
    setActionBusy(true)
    try {
      const base = role === 'accountant' ? '/accountant/receipts' : '/admin/receipts'
      await api.post(`${base}/${id}/approve`)
      await loadStaff()
    } finally {
      setActionBusy(false)
    }
  }

  async function submitCreditRequest() {
    const amt = Number(reqAmount)
    if (!amt) return
    setActionBusy(true)
    try {
      await api.post('/customer/wallet/top-up-request', { amount: amt, notes: reqNotes.trim() || undefined })
      setRequestOpen(false)
      setReqAmount('')
      setReqNotes('')
      await loadCustomer()
    } finally {
      setActionBusy(false)
    }
  }

  async function submitReceiptUpload() {
    const amt = Number(uploadAmount)
    if (!amt) return
    setActionBusy(true)
    try {
      const fd = new FormData()
      fd.append('amount', String(amt))
      if (uploadNotes.trim()) fd.append('notes', uploadNotes.trim())
      if (uploadFile) fd.append('file', uploadFile)
      await api.post('/customer/receipts', fd)
      setUploadOpen(false)
      setUploadAmount('')
      setUploadNotes('')
      setUploadFile(null)
      await loadCustomer()
    } finally {
      setActionBusy(false)
    }
  }

  const currentBalance = isCustomer ? (wallet?.balance ?? 0) : 0
  const pendingBal = isCustomer ? (wallet?.pending_balance ?? 0) : 0
  const thisMonth = isCustomer ? (wallet?.spending_this_month ?? 0) : 0

  const filteredTx = transactions

  const qCredit = creditListSearch.trim().toLowerCase()
  const filteredPendingCredits = useMemo(() => {
    if (!qCredit) return pendingCredits
    return pendingCredits.filter(
      (row) =>
        String(row.user_name ?? '').toLowerCase().includes(qCredit) ||
        String(row.user_email ?? '').toLowerCase().includes(qCredit),
    )
  }, [pendingCredits, qCredit])

  const qStaffRec = staffReceiptSearch.trim().toLowerCase()
  const filteredReceiptRows = useMemo(() => {
    if (!qStaffRec) return receiptRows
    return receiptRows.filter(
      (r) =>
        String(r.user_name ?? '').toLowerCase().includes(qStaffRec) ||
        String(r.user_email ?? '').toLowerCase().includes(qStaffRec),
    )
  }, [receiptRows, qStaffRec])

  const qArch = archiveReceiptSearch.trim().toLowerCase()
  const filteredAdminReceipts = useMemo(() => {
    if (!qArch) return adminAllReceipts
    return adminAllReceipts.filter(
      (r) =>
        String(r.user_name ?? '').toLowerCase().includes(qArch) ||
        String(r.user_email ?? '').toLowerCase().includes(qArch),
    )
  }, [adminAllReceipts, qArch])

  return (
    <section className="page-grid">
      <div className="page-title page-title--row">
        <div>
          <h2>{t(language, 'billing.title')}</h2>
          <p>{t(language, 'billing.subtitle')}</p>
        </div>
        <div className="row-actions">
          {canDirectTopUp ? (
            <button type="button" className="primary-btn" onClick={() => setTopUpOpen(true)}>
              <Plus size={16} /> {t(language, 'billing.topUp')}
            </button>
          ) : null}
          {isCustomer ? (
            <>
              <button type="button" className="primary-btn" onClick={() => setRequestOpen(true)}>
                {t(language, 'billing.requestCredit')}
              </button>
              <button type="button" className="ghost-btn" onClick={() => setUploadOpen(true)}>
                <Upload size={16} /> {t(language, 'billing.uploadReceipt')}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mini-kpi-grid">
        <div className="mini-kpi">
          <small>{t(language, 'billing.currentBalance')}</small>
          <strong>{loading && isCustomer ? '…' : currency(currentBalance)}</strong>
        </div>
        <div className="mini-kpi">
          <small>{t(language, 'billing.pending')}</small>
          <strong>{loading && isCustomer ? '…' : currency(pendingBal)}</strong>
        </div>
        <div className="mini-kpi">
          <small>{t(language, 'billing.thisMonth')}</small>
          <strong>{loading && isCustomer ? '…' : currency(thisMonth)}</strong>
        </div>
        <div className="mini-kpi">
          <small>{t(language, 'billing.receiptsPending')}</small>
          <strong>{isCustomer ? customerReceiptsPending : receiptRows.length}</strong>
        </div>
      </div>

      {canApproveCredits ? (
        <SectionCard
          id="credit-requests-panel"
          title={`${t(language, 'billing.creditRequests')}${pendingCredits.length ? ` (${pendingCredits.length})` : ''}`}
          description={t(language, 'billing.creditRequestsHint')}
        >
          {staffLoading ? (
            <TableSkeletonRows rows={4} cols={5} />
          ) : pendingCredits.length === 0 ? (
            <p className="muted">{t(language, 'billing.noPendingCredits')}</p>
          ) : (
            <>
              <input
                type="search"
                className="list-search"
                placeholder={t(language, 'billing.searchCreditsPlaceholder')}
                value={creditListSearch}
                onChange={(e) => setCreditListSearch(e.target.value)}
                aria-label={t(language, 'billing.searchCreditsPlaceholder')}
              />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t(language, 'billing.customer')}</th>
                    <th>{t(language, 'billing.amount')}</th>
                    <th>{t(language, 'billing.notesColumn')}</th>
                    <th>{t(language, 'billing.date')}</th>
                    <th>{t(language, 'users.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingCredits.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.user_name}</strong>
                        <div className="muted">{row.user_email}</div>
                      </td>
                      <td>{currency(row.amount)}</td>
                      <td className="muted">{row.description}</td>
                      <td>{row.created_at?.slice(0, 10)}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="primary-btn small-inline" disabled={actionBusy} onClick={() => void approveCredit(row.id)}>
                            {t(language, 'billing.approve')}
                          </button>
                          <button
                            type="button"
                            className="ghost-btn small-inline"
                            disabled={actionBusy}
                            onClick={() => {
                              setRejectKind('credit')
                              setRejectId(row.id)
                              setRejectOpen(true)
                            }}
                          >
                            {t(language, 'billing.reject')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title=""
        action={
          <div className="tabs-row tabs-row--full">
            {canApproveCredits ? (
              <button
                type="button"
                className="tab-btn tab-btn--link"
                onClick={() => document.getElementById('credit-requests-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                {t(language, 'billing.creditRequests')}
                {pendingCredits.length ? <span className="tab-badge">{pendingCredits.length}</span> : null}
              </button>
            ) : null}
            <button type="button" className={`tab-btn ${tab === 'transactions' ? 'active' : ''}`} onClick={() => setTab('transactions')}>
              {t(language, 'billing.transactions')}
            </button>
            <button type="button" className={`tab-btn ${tab === 'receipts' ? 'active' : ''}`} onClick={() => setTab('receipts')}>
              {t(language, 'billing.receipts')}
            </button>
            {canApproveReceipts ? (
              <button type="button" className={`tab-btn ${tab === 'all_receipts' ? 'active' : ''}`} onClick={() => setTab('all_receipts')}>
                {t(language, 'billing.allReceiptsArchive')}
              </button>
            ) : null}
          </div>
        }
      >
        {tab === 'receipts' ? (
          <div className="table-wrap">
            {isCustomer ? (
              loading ? (
                <TableSkeletonRows rows={4} cols={4} />
              ) : customerReceiptList.length === 0 ? (
                <p className="muted">{t(language, 'billing.noCustomerReceipts')}</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t(language, 'billing.amount')}</th>
                      <th>{t(language, 'billing.date')}</th>
                      <th>{t(language, 'billing.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerReceiptList.map((r) => (
                      <tr key={r.id}>
                        <td>{r.receipt_number ?? r.id}</td>
                        <td>{currency(r.amount)}</td>
                        <td>{r.created_at?.slice(0, 10)}</td>
                        <td>
                          <span className={`pill ${r.status === 'approved' ? 'pill--green' : r.status === 'rejected' ? 'pill--red' : 'pill--amber'}`}>
                            {statusLabel(language, r.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : staffLoading ? (
              <TableSkeletonRows rows={5} cols={6} />
            ) : receiptRows.length === 0 ? (
              <p className="muted">{t(language, 'billing.noStaffPendingReceipts')}</p>
            ) : (
              <>
                <input
                  type="search"
                  className="list-search"
                  placeholder={t(language, 'billing.searchReceiptsPlaceholder')}
                  value={staffReceiptSearch}
                  onChange={(e) => setStaffReceiptSearch(e.target.value)}
                  aria-label={t(language, 'billing.searchReceiptsPlaceholder')}
                />
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t(language, 'billing.customer')}</th>
                    <th>{t(language, 'billing.amount')}</th>
                    <th>{t(language, 'billing.date')}</th>
                    <th>{t(language, 'billing.status')}</th>
                    {receiptActions ? <th>{t(language, 'users.actions')}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredReceiptRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.receipt_number ?? r.id}</td>
                      <td>
                        <strong>{r.user_name}</strong>
                        <div className="muted">{r.user_email}</div>
                      </td>
                      <td>{currency(r.amount)}</td>
                      <td>{r.created_at?.slice(0, 10)}</td>
                      <td>
                        <span className="pill pill--amber">{statusLabel(language, r.status)}</span>
                      </td>
                      {receiptActions ? (
                        <td>
                          <div className="row-actions">
                            <button type="button" className="primary-btn small-inline" disabled={actionBusy} onClick={() => void approveReceipt(r.id)}>
                              {t(language, 'billing.approve')}
                            </button>
                            <button
                              type="button"
                              className="ghost-btn small-inline"
                              disabled={actionBusy}
                              onClick={() => {
                                setRejectKind('receipt')
                                setRejectId(r.id)
                                setRejectOpen(true)
                              }}
                            >
                              {t(language, 'billing.reject')}
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </div>
        ) : null}

        {tab === 'all_receipts' && canApproveReceipts ? (
          <div className="table-wrap">
            {staffLoading ? (
              <TableSkeletonRows rows={5} cols={5} />
            ) : adminAllReceipts.length === 0 ? (
              <p className="muted">{t(language, 'billing.noReceiptsArchive')}</p>
            ) : (
              <>
                <input
                  type="search"
                  className="list-search"
                  placeholder={t(language, 'billing.searchReceiptsPlaceholder')}
                  value={archiveReceiptSearch}
                  onChange={(e) => setArchiveReceiptSearch(e.target.value)}
                  aria-label={t(language, 'billing.searchReceiptsPlaceholder')}
                />
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t(language, 'billing.customer')}</th>
                    <th>{t(language, 'billing.amount')}</th>
                    <th>{t(language, 'billing.date')}</th>
                    <th>{t(language, 'billing.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAdminReceipts.map((r) => (
                    <tr key={r.id}>
                      <td>{r.receipt_number ?? r.id}</td>
                      <td>
                        <strong>{r.user_name}</strong>
                        <div className="muted">{r.user_email}</div>
                      </td>
                      <td>{currency(r.amount)}</td>
                      <td>{r.created_at?.slice(0, 10)}</td>
                      <td>
                        <span
                          className={`pill ${r.status === 'approved' ? 'pill--green' : r.status === 'rejected' ? 'pill--red' : 'pill--amber'}`}
                        >
                          {statusLabel(language, r.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </>
            )}
          </div>
        ) : null}

        {tab === 'transactions' ? (
          <>
            {isCustomer ? (
              <div className="table-wrap">
                {loading && filteredTx.length === 0 ? (
                  <TableSkeletonRows rows={6} cols={5} />
                ) : null}
                <table style={loading && filteredTx.length === 0 ? { display: 'none' } : undefined}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t(language, 'billing.type')}</th>
                      <th className="th-num">{t(language, 'billing.amount')}</th>
                      <th>{t(language, 'billing.date')}</th>
                      <th>{t(language, 'billing.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          {language === 'ar' ? 'لا معاملات بعد.' : 'No transactions yet.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTx.map((row) => (
                        <tr key={String(row.id)}>
                          <td>{String(row.number ?? row.id)}</td>
                          <td>{String(row.type)}</td>
                          <td className="td-num">{currency(Number(row.amount))}</td>
                          <td>{String(row.date ?? '')}</td>
                          <td>
                            <span className="pill pill--gray">{String(row.status)}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-wrap">
                {staffLoading ? (
                  <TableSkeletonRows rows={6} cols={5} />
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>{t(language, 'billing.customer')}</th>
                        <th>{t(language, 'billing.type')}</th>
                        <th className="th-num">{t(language, 'billing.amount')}</th>
                        <th>{t(language, 'billing.status')}</th>
                        <th>{t(language, 'billing.date')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="muted">
                            {t(language, 'billing.noLedgerEntries')}
                          </td>
                        </tr>
                      ) : (
                        staffTransactions.map((row) => (
                          <tr key={String(row.id)}>
                            <td>
                              <strong>{String(row.user_name ?? '')}</strong>
                              <div className="muted">{String(row.user_email ?? '')}</div>
                            </td>
                            <td>{String(row.type)}</td>
                            <td className="td-num">{currency(Number(row.amount))}</td>
                            <td>{String(row.status)}</td>
                            <td>{String(row.created_at ?? '').slice(0, 10)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        ) : null}
      </SectionCard>

      <Modal
        title={t(language, 'billing.topUp')}
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setTopUpOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={actionBusy} onClick={() => void submitTopUp()}>
              {actionBusy ? '…' : t(language, 'billing.topUp')}
            </button>
          </div>
        }
      >
        <div className="settings-grid">
          <label>
            <span>{t(language, 'billing.selectCustomer')}</span>
            <select value={topUpUserId} onChange={(e) => setTopUpUserId(e.target.value)}>
              <option value="">—</option>
              {customerOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t(language, 'billing.amountLabel')}</span>
            <input type="number" min={0.01} step="0.01" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'billing.notePlaceholder')}</span>
            <input value={topUpNote} onChange={(e) => setTopUpNote(e.target.value)} />
          </label>
        </div>
      </Modal>

      <Modal
        title={t(language, 'billing.requestCredit')}
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setRequestOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={actionBusy} onClick={() => void submitCreditRequest()}>
              {actionBusy ? '…' : t(language, 'billing.submitRequest')}
            </button>
          </div>
        }
      >
        <div className="settings-grid">
          <label>
            <span>{t(language, 'billing.amountLabel')}</span>
            <input type="number" min={0.01} step="0.01" value={reqAmount} onChange={(e) => setReqAmount(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'billing.notePlaceholder')}</span>
            <input value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} />
          </label>
        </div>
      </Modal>

      <Modal
        title={t(language, 'billing.uploadReceipt')}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setUploadOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={actionBusy} onClick={() => void submitReceiptUpload()}>
              {actionBusy ? '…' : t(language, 'billing.uploadReceipt')}
            </button>
          </div>
        }
      >
        <div className="settings-grid">
          <label>
            <span>{t(language, 'billing.amountLabel')}</span>
            <input type="number" min={0.01} step="0.01" value={uploadAmount} onChange={(e) => setUploadAmount(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'billing.notePlaceholder')}</span>
            <input value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'billing.openFile')}</span>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </Modal>

      <Modal
        title={t(language, 'billing.reject')}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setRejectOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={actionBusy} onClick={() => void submitReject()}>
              {actionBusy ? '…' : t(language, 'billing.reject')}
            </button>
          </div>
        }
      >
        <label>
          <span>{t(language, 'billing.rejectReason')}</span>
          <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </label>
      </Modal>
    </section>
  )
}
