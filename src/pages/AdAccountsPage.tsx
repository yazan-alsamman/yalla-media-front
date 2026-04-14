import { Building2, Eye, KeyRound, Pencil, Plus, Power, RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AdAccountDetailView } from '../components/StructuredEntityDetails'
import { ConfirmDialog } from '../components/AppDialog'
import { Modal } from '../components/Modal'
import { SectionCard } from '../components/SectionCard'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { TruncatedCopy } from '../components/TruncatedCopy'
import { SkeletonLine } from '../components/Skeleton'
import { statusLabel, t } from '../i18n'

type Row = Record<string, unknown>

function asRows(res: unknown): Row[] {
  if (!res || typeof res !== 'object') return []
  const o = res as { data?: unknown }
  const d = o.data
  if (Array.isArray(d)) return d as Row[]
  if (d && typeof d === 'object' && Array.isArray((d as { data?: unknown }).data)) {
    return (d as { data: Row[] }).data
  }
  return []
}

type ListMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const emptyForm = {
  meta_ad_account_id: '',
  name: '',
  access_token: '',
  currency: 'USD',
  timezone: '',
  platform: 'facebook',
  page_url: '',
  contact: '',
}

export function AdAccountsPage() {
  const { role, language } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkConsumed = useRef<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [listMeta, setListMeta] = useState<ListMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [editName, setEditName] = useState('')
  const [editCurrency, setEditCurrency] = useState('')
  const [editStatus, setEditStatus] = useState('active')

  const [tokenOpen, setTokenOpen] = useState(false)
  const [tokenId, setTokenId] = useState<number | null>(null)
  const [newToken, setNewToken] = useState('')

  const [showOpen, setShowOpen] = useState(false)
  const [showRecord, setShowRecord] = useState<Record<string, unknown> | null>(null)

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  const isCustomer = role === 'customer'
  const isSuperAdmin = role === 'super_admin'

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter])

  const loadCustomer = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/customer/ad-accounts')
      setRows(asRows(res))
      setListMeta(null)
    } catch (e) {
      setRows([])
      setListMeta(null)
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStaff = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const path = role === 'employee' ? '/employee/ad-accounts' : '/admin/ad-accounts'
      const res = (await api.get(path, {
        params: {
          search: debouncedSearch.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          per_page: 100,
          page,
        },
      })) as { data?: unknown; meta?: Partial<ListMeta> }
      setRows(asRows(res))
      const m = res.meta
      if (m && typeof m === 'object' && 'last_page' in m) {
        setListMeta({
          current_page: Number(m.current_page),
          last_page: Number(m.last_page),
          per_page: Number(m.per_page),
          total: Number(m.total),
        })
      } else {
        setListMeta(null)
      }
    } catch (e) {
      setRows([])
      setListMeta(null)
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [role, debouncedSearch, statusFilter, page])

  useEffect(() => {
    if (isCustomer) void loadCustomer()
    else void loadStaff()
  }, [isCustomer, loadCustomer, loadStaff])

  const openAdAccountParam = searchParams.get('open')

  useEffect(() => {
    if (isCustomer || loading) return
    const raw = openAdAccountParam
    if (!raw) {
      deepLinkConsumed.current = null
      return
    }
    if (deepLinkConsumed.current === raw) return
    const id = Number(raw)
    if (!Number.isFinite(id)) return
    deepLinkConsumed.current = raw
    void (async () => {
      setShowOpen(true)
      setShowRecord(null)
      try {
        const path =
          role === 'employee' ? `/employee/ad-accounts/${id}` : `/admin/ad-accounts/${id}`
        const res = (await api.get(path)) as { data?: Record<string, unknown> }
        setShowRecord((res.data && typeof res.data === 'object' ? res.data : {}) as Record<string, unknown>)
      } catch {
        setShowRecord({})
      } finally {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('open')
            return next
          },
          { replace: true },
        )
        deepLinkConsumed.current = null
      }
    })()
  }, [isCustomer, loading, role, openAdAccountParam, setSearchParams])

  const displayedCustomerRows = useMemo(() => {
    if (!isCustomer) return rows
    const q = searchInput.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const name = String(r.name ?? '').toLowerCase()
      const mid = String(r.meta_ad_account_id ?? '').toLowerCase()
      return name.includes(q) || mid.includes(q)
    })
  }, [isCustomer, rows, searchInput])

  const tableRows = isCustomer ? displayedCustomerRows : rows

  async function submitCreate() {
    if (!form.meta_ad_account_id.trim() || !form.name.trim()) return
    setBusyId(-1)
    try {
      await api.post('/customer/ad-accounts', {
        meta_ad_account_id: form.meta_ad_account_id.trim(),
        name: form.name.trim(),
        access_token: form.access_token.trim() || undefined,
        currency: form.currency.trim() || undefined,
        timezone: form.timezone.trim() || undefined,
        platform: form.platform.trim() || undefined,
        page_url: form.page_url.trim() || undefined,
        contact: form.contact.trim() || undefined,
      })
      setCreateOpen(false)
      setForm(emptyForm)
      await loadCustomer()
    } finally {
      setBusyId(null)
    }
  }

  function openEdit(row: Row) {
    setEditing(row)
    setEditName(String(row.name ?? ''))
    setEditCurrency(String(row.currency ?? 'USD'))
    setEditStatus(String(row.status ?? 'active'))
    setEditOpen(true)
  }

  async function submitEdit() {
    if (!editing) return
    if (!isCustomer && !isSuperAdmin) return
    const id = Number(editing.id)
    setBusyId(id)
    try {
      if (isCustomer) {
        await api.put(`/customer/ad-accounts/${id}`, {
          name: editName.trim(),
          currency: editCurrency.trim() || undefined,
          status: editStatus,
        })
      } else if (isSuperAdmin) {
        await api.put(`/admin/ad-accounts/${id}`, {
          name: editName.trim(),
          currency: editCurrency.trim() || undefined,
          status: editStatus,
        })
      }
      setEditOpen(false)
      setEditing(null)
      if (isCustomer) await loadCustomer()
      else await loadStaff()
    } finally {
      setBusyId(null)
    }
  }

  function requestRemoveRow(id: number) {
    setPendingDeleteId(id)
  }

  async function confirmRemoveRow() {
    const id = pendingDeleteId
    if (id == null) return
    setPendingDeleteId(null)
    setBusyId(id)
    try {
      await api.delete(`/customer/ad-accounts/${id}`)
      await loadCustomer()
    } finally {
      setBusyId(null)
    }
  }

  async function syncRow(id: number) {
    setBusyId(id)
    try {
      await api.post(`/customer/ad-accounts/${id}/sync`)
      await loadCustomer()
    } finally {
      setBusyId(null)
    }
  }

  function openToken(id: number) {
    setTokenId(id)
    setNewToken('')
    setTokenOpen(true)
  }

  async function openShow(id: number) {
    setBusyId(id)
    setShowOpen(true)
    setShowRecord(null)
    try {
      const path =
        role === 'customer'
          ? `/customer/ad-accounts/${id}`
          : role === 'employee'
            ? `/employee/ad-accounts/${id}`
            : `/admin/ad-accounts/${id}`
      const res = (await api.get(path)) as { data?: Record<string, unknown> }
      setShowRecord((res.data && typeof res.data === 'object' ? res.data : {}) as Record<string, unknown>)
    } catch {
      setShowRecord({})
    } finally {
      setBusyId(null)
    }
  }

  async function submitToken() {
    if (tokenId == null || !newToken.trim()) return
    setBusyId(tokenId)
    try {
      await api.post(`/customer/ad-accounts/${tokenId}/refresh-token`, { access_token: newToken.trim() })
      setTokenOpen(false)
      setTokenId(null)
      await loadCustomer()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="page-grid">
      <div className="page-title page-title--row">
        <div>
          <h2>{t(language, 'adAccounts.title')}</h2>
          <p>{t(language, 'adAccounts.subtitle')}</p>
        </div>
        <span className="pill pill--gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Building2 size={14} /> {t(language, 'adAccounts.integrationsBadge')}
        </span>
      </div>

      {isCustomer ? (
        <div className="row-actions" style={{ marginBottom: 8 }}>
          <button type="button" className="primary-btn" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> {t(language, 'adAccounts.addAccountBtn')}
          </button>
        </div>
      ) : (
        <p className="muted type-caption" style={{ marginBottom: 10 }}>
          {t(language, 'adAccounts.staffHint')}
        </p>
      )}

      <div className="filter-grid filter-grid--users ad-accounts-toolbar" style={{ marginBottom: 12 }}>
        <label className="list-search" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0 }}>
          <Search size={18} className="muted" aria-hidden />
          <input
            type="search"
            className="tracking-search-input"
            placeholder={t(language, 'adAccounts.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoComplete="off"
          />
          {searchInput ? (
            <button type="button" className="ghost-btn" onClick={() => setSearchInput('')}>
              {language === 'ar' ? 'مسح' : 'Clear'}
            </button>
          ) : null}
        </label>
        {!isCustomer ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="type-caption muted">{t(language, 'adAccounts.filterStatus')}</span>
            <select
              className="tracking-search-input"
              style={{ maxWidth: 220 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">{t(language, 'adAccounts.filterAll')}</option>
              <option value="active">{statusLabel(language, 'active')}</option>
              <option value="inactive">{statusLabel(language, 'inactive')}</option>
              <option value="revoked">{statusLabel(language, 'revoked')}</option>
              <option value="pending_link">{statusLabel(language, 'pending_link')}</option>
            </select>
          </label>
        ) : null}
      </div>

      <SectionCard title={t(language, 'adAccounts.directory')}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonLine key={i} />
            ))}
          </div>
        ) : error ? (
          <p className="login-error">{error}</p>
        ) : tableRows.length === 0 ? (
          <p className="muted">{language === 'ar' ? 'لا حسابات إعلان.' : 'No ad accounts yet.'}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  {role !== 'customer' ? <th>Customer</th> : null}
                  <th>{t(language, 'adAccounts.metaId')}</th>
                  <th>{t(language, 'adAccounts.platform')}</th>
                  <th>{t(language, 'users.status')}</th>
                  <th className="th-num">{language === 'ar' ? 'العملة' : 'Currency'}</th>
                  <th>{t(language, 'adAccounts.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r) => {
                  const id = Number(r.id)
                  return (
                    <tr
                      key={id}
                      className={!isCustomer ? 'ad-accounts-row--clickable' : undefined}
                      onClick={!isCustomer ? () => void openShow(id) : undefined}
                    >
                      <td>
                        <strong>{String(r.name ?? '')}</strong>
                      </td>
                  {role !== 'customer' ? (
                    <td>
                      {String(r.customer_name ?? '—')}
                      <div className="muted">{String(r.customer_email ?? '')}</div>
                    </td>
                  ) : null}
                  <td>
                        <TruncatedCopy value={String(r.meta_ad_account_id ?? r.id ?? '—')} maxLen={12} />
                      </td>
                      <td>
                        <span className="pill pill--gray">{String(r.platform ?? '—')}</span>
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            String(r.status) === 'active'
                              ? 'pill--green'
                              : String(r.status) === 'inactive'
                                ? 'pill--gray'
                                : String(r.status) === 'revoked'
                                  ? 'pill--red'
                                  : 'pill--amber'
                          }`}
                        >
                          {statusLabel(language, String(r.status ?? ''))}
                        </span>
                      </td>
                      <td className="td-num">{String(r.currency ?? '—')}</td>
                      {isCustomer ? (
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              title={t(language, 'adAccounts.viewDetails')}
                              aria-label={t(language, 'adAccounts.viewDetails')}
                              disabled={busyId === id}
                              onClick={() => void openShow(id)}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              title={t(language, 'adAccounts.edit')}
                              aria-label={t(language, 'adAccounts.edit')}
                              disabled={busyId === id}
                              onClick={() => openEdit(r)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              title={language === 'ar' ? 'مزامنة' : 'Sync from Meta'}
                              aria-label={language === 'ar' ? 'مزامنة' : 'Sync from Meta'}
                              disabled={busyId === id}
                              onClick={() => void syncRow(id)}
                            >
                              <RefreshCw size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              title={language === 'ar' ? 'تحديث الرمز' : 'Update access token'}
                              aria-label={language === 'ar' ? 'تحديث الرمز' : 'Update access token'}
                              disabled={busyId === id}
                              onClick={() => openToken(id)}
                            >
                              <KeyRound size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              title={t(language, 'adAccounts.disableBtn')}
                              aria-label={t(language, 'adAccounts.disableBtn')}
                              disabled={busyId === id}
                              onClick={() => requestRemoveRow(id)}
                            >
                              <Power size={15} />
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              title={t(language, 'adAccounts.viewDetails')}
                              aria-label={t(language, 'adAccounts.viewDetails')}
                              disabled={busyId === id}
                              onClick={() => void openShow(id)}
                            >
                              <Eye size={15} />
                            </button>
                            {isSuperAdmin ? (
                              <button
                                type="button"
                                className="icon-btn"
                                title={t(language, 'adAccounts.edit')}
                                aria-label={t(language, 'adAccounts.edit')}
                                disabled={busyId === id}
                                onClick={() => openEdit(r)}
                              >
                                <Pencil size={15} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {listMeta && listMeta.last_page > 1 ? (
              <div
                className="row-actions"
                style={{ justifyContent: 'space-between', marginTop: 12, flexWrap: 'wrap', gap: 10 }}
              >
                <span className="type-caption muted">
                  {t(language, 'adAccounts.resultsMeta')
                    .replace(
                      '{from}',
                      String(Math.min(listMeta.total, (listMeta.current_page - 1) * listMeta.per_page + 1)),
                    )
                    .replace('{to}', String(Math.min(listMeta.total, listMeta.current_page * listMeta.per_page)))
                    .replace('{total}', String(listMeta.total))}
                </span>
                <div className="row-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t(language, 'adAccounts.pagePrev')}
                  </button>
                  <span className="type-caption muted" style={{ alignSelf: 'center' }}>
                    {listMeta.current_page} / {listMeta.last_page}
                  </span>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={page >= listMeta.last_page || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t(language, 'adAccounts.pageNext')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>

      <Modal
        title="Create ad account"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void submitCreate()}>
              {busyId != null ? '…' : 'Create'}
            </button>
          </div>
        }
      >
        <div className="settings-grid">
          <label>
            <span>Meta ad account ID *</span>
            <input value={form.meta_ad_account_id} onChange={(e) => setForm((f) => ({ ...f, meta_ad_account_id: e.target.value }))} />
          </label>
          <label>
            <span>Name *</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label>
            <span>Access token (optional)</span>
            <input value={form.access_token} onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))} />
          </label>
          <label>
            <span>Currency</span>
            <input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} />
          </label>
          <label>
            <span>Platform</span>
            <input value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} />
          </label>
          <label>
            <span>Page URL</span>
            <input value={form.page_url} onChange={(e) => setForm((f) => ({ ...f, page_url: e.target.value }))} />
          </label>
          <label>
            <span>Contact</span>
            <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
          </label>
        </div>
      </Modal>

      <Modal
        title={t(language, 'adAccounts.editModalTitle')}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setEditOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void submitEdit()}>
              {busyId != null ? '…' : t(language, 'adAccounts.save')}
            </button>
          </div>
        }
      >
        <div className="settings-grid">
          <label>
            <span>{language === 'ar' ? 'الاسم' : 'Name'}</span>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'adAccounts.currency')}</span>
            <input value={editCurrency} onChange={(e) => setEditCurrency(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'users.status')}</span>
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              <option value="active">{statusLabel(language, 'active')}</option>
              <option value="inactive">{statusLabel(language, 'inactive')}</option>
              <option value="revoked">{statusLabel(language, 'revoked')}</option>
              {(isSuperAdmin || String(editing?.status ?? '') === 'pending_link') && (
                <option value="pending_link">{statusLabel(language, 'pending_link')}</option>
              )}
            </select>
          </label>
        </div>
      </Modal>

      <Modal title={t(language, 'adAccounts.detailTitle')} open={showOpen} onClose={() => setShowOpen(false)}>
        {showRecord ? (
          <AdAccountDetailView data={showRecord} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonLine key={i} />
            ))}
          </div>
        )}
      </Modal>

      <Modal
        title={t(language, 'adAccounts.refreshTokenTitle')}
        open={tokenOpen}
        onClose={() => setTokenOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setTokenOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void submitToken()}>
              {busyId != null ? '…' : t(language, 'adAccounts.saveToken')}
            </button>
          </div>
        }
      >
        <label>
          <span>{t(language, 'adAccounts.newAccessToken')}</span>
          <textarea className="modal-textarea" rows={3} value={newToken} onChange={(e) => setNewToken(e.target.value)} />
        </label>
      </Modal>

      <ConfirmDialog
        open={pendingDeleteId != null}
        title={t(language, 'adAccounts.title')}
        message={t(language, 'adAccounts.deleteConfirm')}
        confirmLabel={t(language, 'adAccounts.disableBtn')}
        cancelLabel={t(language, 'users.cancel')}
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void confirmRemoveRow()}
      />
    </section>
  )
}
