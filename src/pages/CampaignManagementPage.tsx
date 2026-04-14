import { Check, Eye, Link2, Pause, Play, Plus, Power, RefreshCw, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getStaffCampaignUIMode } from '../lib/staffConfig'
import { CampaignCustomerDetailView, CampaignInsightsView, CampaignStaffDetailView } from '../components/StructuredEntityDetails'
import { AlertDialog, ConfirmDialog } from '../components/AppDialog'
import { Modal } from '../components/Modal'
import { SectionCard } from '../components/SectionCard'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { campaignStatusPillClass } from '../lib/campaignStatusUi'
import { statusLabel, t } from '../i18n'
import { currency, formatGroupedInt } from '../utils/format'

type Row = {
  id: number
  name: string
  owner: string
  status: string
  clicks: number
  impressions: number
  spend: number
  budget: number
  period: string
  meta_campaign_id?: string | null
}

type StaffMetaStoredSummary = {
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

function extractList<T = Record<string, unknown>>(res: unknown): T[] {
  if (!res || typeof res !== 'object') return []
  const r = res as { data?: unknown }
  if (Array.isArray(r.data)) return r.data as T[]
  const inner = r.data as { data?: unknown }
  if (inner && typeof inner === 'object' && Array.isArray(inner.data)) return inner.data as T[]
  return []
}

function mapCustomerRow(raw: Record<string, unknown>): Row {
  const status = String(raw.status ?? 'pending')
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ''),
    owner: '—',
    status,
    clicks: Number(raw.clicks ?? 0),
    impressions: Number(raw.impressions ?? 0),
    spend: Number(raw.spend ?? raw.totalSpending ?? 0),
    budget: Number(raw.budget ?? raw.dailyBudget ?? 0),
    period: String(raw.created_at ?? raw.createdAt ?? ''),
    meta_campaign_id: raw.meta_campaign_id != null ? String(raw.meta_campaign_id) : null,
  }
}

function mapStaffRow(raw: Record<string, unknown>): Row {
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ''),
    owner: String(raw.customer_name ?? raw.customer_email ?? '—'),
    status: String(raw.status ?? ''),
    clicks: Number(raw.clicks ?? 0),
    impressions: 0,
    spend: Number(raw.spend ?? 0),
    budget: Number(raw.budget ?? 0),
    period: [raw.start_date, raw.end_date].filter(Boolean).join(' → '),
    meta_campaign_id: raw.meta_campaign_id != null ? String(raw.meta_campaign_id) : null,
  }
}

export function CampaignManagementPage() {
  const [searchParams] = useSearchParams()
  const { role, language, currentUser } = useAppContext()
  const uiMode = getStaffCampaignUIMode(role, currentUser?.employee_type)
  const canReviewCampaigns = role === 'employee' || role === 'super_admin' || role === 'admin'
  const canDeleteAsAdmin = role === 'super_admin' || role === 'admin'
  const isCustomer = role === 'customer'

  const showLinkingActions = canReviewCampaigns && (uiMode === 'full' || uiMode === 'linking')
  const showUploadApprovalActions = canReviewCampaigns && (uiMode === 'full' || uiMode === 'uploading')
  const showPauseResume = canReviewCampaigns && uiMode === 'full'
  const showSetLink = canReviewCampaigns && (uiMode === 'full' || uiMode === 'linking')
  const showSync = canReviewCampaigns && (uiMode === 'full' || uiMode === 'tracking')

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  // Default to approval queue so new app submissions are not buried under "All" (pagination + demo data).
  const [staffSource, setStaffSource] = useState<'all' | 'pending'>('pending')
  const [campaignSearch, setCampaignSearch] = useState('')

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [detailOpen, setDetailOpen] = useState(false)
  const [staffDetail, setStaffDetail] = useState<Record<string, unknown> | null>(null)

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkId, setLinkId] = useState<number | null>(null)
  const [linkValue, setLinkValue] = useState('')

  const [linkingOpen, setLinkingOpen] = useState(false)
  const [linkingId, setLinkingId] = useState<number | null>(null)
  const [linkingMeta, setLinkingMeta] = useState('')
  const [linkingAdAcc, setLinkingAdAcc] = useState('')

  const [types, setTypes] = useState<{ id: number; name?: string; display_name?: string }[]>([])
  const [adAccounts, setAdAccounts] = useState<{ id: number; name?: string }[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [cName, setCName] = useState('')
  const [cTypeId, setCTypeId] = useState('')
  const [cAdAcc, setCAdAcc] = useState('')
  const [cBudget, setCBudget] = useState('')
  const [cDaily, setCDaily] = useState('')
  const [cDesc, setCDesc] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [eName, setEName] = useState('')
  const [eBudget, setEBudget] = useState('')
  const [eDaily, setEDaily] = useState('')
  const [eStatus, setEStatus] = useState('pending')

  const [insightsOpen, setInsightsOpen] = useState(false)
  const [insightsData, setInsightsData] = useState<Record<string, unknown> | null>(null)

  const [custShowOpen, setCustShowOpen] = useState(false)
  const [custShowData, setCustShowData] = useState<Record<string, unknown> | null>(null)

  const [staffMetaStored, setStaffMetaStored] = useState<StaffMetaStoredSummary | null>(null)

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [alertDialog, setAlertDialog] = useState<{ open: boolean; message: string }>({ open: false, message: '' })

  const staffListSearch = !isCustomer && staffSource === 'all' ? campaignSearch.trim() : ''

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (isCustomer) {
        const res = await api.get('/customer/campaigns')
        setRows(extractList<Record<string, unknown>>(res).map(mapCustomerRow))
      } else if (staffSource === 'pending') {
        const res = await api.get('/employee/campaigns/pending')
        setRows(extractList<Record<string, unknown>>(res).map(mapStaffRow))
      } else {
        const res = await api.get('/employee/campaigns', {
          params: { per_page: 100, search: staffListSearch || undefined },
        })
        setRows(extractList<Record<string, unknown>>(res).map(mapStaffRow))
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [isCustomer, staffSource, staffListSearch])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q == null || q === '') return
    setCampaignSearch(q)
    if (!isCustomer) {
      setStaffSource('all')
    }
  }, [searchParams, isCustomer])

  useEffect(() => {
    const st = searchParams.get('status')
    if (st == null || st.trim() === '') return
    if (!isCustomer) {
      setStaffSource('all')
    }
  }, [searchParams, isCustomer])

  useEffect(() => {
    if (uiMode === 'uploading' || uiMode === 'tracking') {
      setStaffSource('all')
    }
  }, [uiMode])

  useEffect(() => {
    if (isCustomer || !canReviewCampaigns) {
      setStaffMetaStored(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = (await api.get('/employee/meta/stored-insights-summary', { params: { days: 7 } })) as {
          data?: StaffMetaStoredSummary
        }
        if (!cancelled) setStaffMetaStored(res.data ?? null)
      } catch {
        if (!cancelled) setStaffMetaStored(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isCustomer, canReviewCampaigns])

  useEffect(() => {
    if (!isCustomer) return
    void (async () => {
      try {
        const ct = (await api.get('/campaign-types')) as { data?: { id: number; name?: string; display_name?: string }[] }
        setTypes(Array.isArray(ct.data) ? ct.data : [])
        const aa = (await api.get('/customer/ad-accounts')) as { data?: { id: number; name?: string }[] }
        setAdAccounts(Array.isArray(aa.data) ? aa.data : [])
      } catch {
        setTypes([])
        setAdAccounts([])
      }
    })()
  }, [isCustomer])

  const statusFromUrl = searchParams.get('status')

  const displayRows = useMemo(() => {
    let list = rows
    if (statusFromUrl && statusFromUrl.trim() !== '') {
      const s = statusFromUrl.trim().toLowerCase().replace(/-/g, '_')
      if (s === 'pending') {
        list = list.filter((c) => ['pending', 'pending_approval', 'pending_linking'].includes(c.status))
      } else {
        list = list.filter((c) => c.status === s)
      }
    }
    const q = campaignSearch.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) => {
      const name = c.name.toLowerCase()
      const owner = c.owner.toLowerCase()
      return name.includes(q) || owner.includes(q)
    })
  }, [rows, campaignSearch, statusFromUrl])

  const active = rows.filter((c) => c.status === 'active').length
  const pending = rows.filter((c) =>
    ['pending', 'pending_approval', 'pending_linking'].includes(c.status),
  ).length
  const totalClicks = rows.reduce((sum, c) => sum + c.clicks, 0)
  const totalSpend = rows.reduce((sum, c) => sum + c.spend, 0)

  async function approve(id: number) {
    setBusyId(id)
    try {
      await api.post(`/employee/campaigns/${id}/approve`, { meta_link: null })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  function openReject(id: number) {
    setRejectId(id)
    setRejectReason('')
    setRejectOpen(true)
  }

  async function confirmReject() {
    if (rejectId == null) return
    const reason = rejectReason.trim()
    if (!reason) return
    setBusyId(rejectId)
    try {
      await api.post(`/employee/campaigns/${rejectId}/reject`, { reason })
      setRejectOpen(false)
      setRejectId(null)
      setRejectReason('')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  function requestRemoveCampaign(id: number) {
    setPendingDeleteId(id)
  }

  async function confirmRemoveCampaign() {
    const id = pendingDeleteId
    if (id == null) return
    setPendingDeleteId(null)
    setBusyId(id)
    try {
      if (isCustomer) {
        await api.delete(`/customer/campaigns/${id}`)
      } else {
        await api.delete(`/employee/campaigns/${id}`)
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function openStaffDetail(id: number) {
    setBusyId(id)
    setDetailOpen(true)
    setStaffDetail(null)
    try {
      const res = (await api.get(`/employee/campaigns/${id}`)) as { data?: Record<string, unknown> }
      setStaffDetail((res.data && typeof res.data === 'object' ? res.data : {}) as Record<string, unknown>)
    } catch {
      setStaffDetail({})
    } finally {
      setBusyId(null)
    }
  }

  async function pauseCamp(id: number) {
    setBusyId(id)
    try {
      await api.post(`/employee/campaigns/${id}/pause`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function resumeCamp(id: number) {
    setBusyId(id)
    try {
      await api.post(`/employee/campaigns/${id}/resume`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  function openSetLink(id: number) {
    setLinkId(id)
    setLinkValue('')
    setLinkOpen(true)
  }

  async function submitSetLink() {
    if (linkId == null || !linkValue.trim()) return
    setBusyId(linkId)
    try {
      await api.post(`/employee/campaigns/${linkId}/set-link`, { meta_link: linkValue.trim() })
      setLinkOpen(false)
      setLinkId(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  function openCompleteLinking(id: number) {
    setLinkingId(id)
    setLinkingMeta('')
    setLinkingAdAcc('')
    setLinkingOpen(true)
  }

  async function submitCompleteLinking() {
    if (linkingId == null || !linkingMeta.trim()) return
    setBusyId(linkingId)
    try {
      await api.post(`/employee/campaigns/${linkingId}/complete-linking`, {
        meta_link: linkingMeta.trim(),
        ad_account_id: linkingAdAcc.trim() ? Number(linkingAdAcc) : undefined,
      })
      setLinkingOpen(false)
      setLinkingId(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function syncStaff(id: number) {
    setBusyId(id)
    try {
      await api.post(`/employee/campaigns/${id}/sync`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function submitCreate() {
    const typeId = Number(cTypeId)
    const budget = Number(cBudget)
    const daily = Number(cDaily)
    if (!cName.trim() || !typeId || !budget || !daily) return
    setBusyId(-1)
    try {
      await api.post('/customer/campaigns', {
        name: cName.trim(),
        campaign_type_id: typeId,
        ad_account_id: cAdAcc ? Number(cAdAcc) : undefined,
        description: cDesc.trim() || undefined,
        budget,
        daily_budget: daily,
      })
      setCreateOpen(false)
      setCName('')
      setCTypeId('')
      setCAdAcc('')
      setCBudget('')
      setCDaily('')
      setCDesc('')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  function openCustomerEdit(row: Row) {
    setEditId(row.id)
    setEName(row.name)
    setEBudget(String(row.budget))
    setEDaily(String(row.budget))
    setEStatus(
      row.status === 'pending' || row.status === 'pending_approval' || row.status === 'pending_linking' ? 'pending' : row.status,
    )
    setEditOpen(true)
  }

  async function submitCustomerEdit() {
    if (editId == null) return
    setBusyId(editId)
    try {
      await api.put(`/customer/campaigns/${editId}`, {
        name: eName.trim(),
        budget: eBudget ? Number(eBudget) : undefined,
        daily_budget: eDaily ? Number(eDaily) : undefined,
        status: eStatus,
      })
      setEditOpen(false)
      setEditId(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function pullMetaInsights(id: number) {
    setBusyId(id)
    try {
      await api.post('/meta/sync/insights', { campaign_id: id })
      await load()
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : t(language, 'dialog.metaSyncFailed')
      setAlertDialog({ open: true, message: msg })
    } finally {
      setBusyId(null)
    }
  }

  async function openInsights(id: number) {
    setBusyId(id)
    setInsightsOpen(true)
    setInsightsData(null)
    try {
      const res = (await api.get(`/customer/campaigns/${id}/insights`)) as { data?: Record<string, unknown> }
      setInsightsData((res.data && typeof res.data === 'object' ? res.data : {}) as Record<string, unknown>)
    } catch {
      setInsightsData({})
    } finally {
      setBusyId(null)
    }
  }

  async function openCustomerShow(id: number) {
    setBusyId(id)
    setCustShowOpen(true)
    setCustShowData(null)
    try {
      const res = (await api.get(`/customer/campaigns/${id}`)) as { data?: Record<string, unknown> }
      setCustShowData((res.data && typeof res.data === 'object' ? res.data : {}) as Record<string, unknown>)
    } catch {
      setCustShowData({})
    } finally {
      setBusyId(null)
    }
  }

  const showDelete = isCustomer || canDeleteAsAdmin

  return (
    <section className="page-grid">
      <div className="page-title page-title--row">
        <div>
          <h2>{t(language, 'campaigns.title')}</h2>
          <p>{t(language, 'campaigns.subtitle')}</p>
        </div>
        {isCustomer ? (
          <button type="button" className="primary-btn" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> {t(language, 'campaigns.create')}
          </button>
        ) : null}
      </div>

      {isCustomer ? (
        <div className="filter-grid filter-grid--users" style={{ marginBottom: 4, alignItems: 'center' }}>
          <div className="search-field" style={{ flex: 1, maxWidth: 420 }}>
            <Search size={16} aria-hidden />
            <input
              type="search"
              placeholder={t(language, 'campaigns.searchPlaceholder')}
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
              title={t(language, 'campaigns.searchTitleHint')}
              aria-label={t(language, 'campaigns.searchPlaceholder')}
            />
          </div>
        </div>
      ) : null}

      {!isCustomer && (uiMode === 'full' || uiMode === 'linking') ? (
        <div className="filter-grid filter-grid--users" style={{ marginBottom: 4, alignItems: 'center' }}>
          <div className="search-field">
            <Search size={16} aria-hidden />
            <input
              type="search"
              placeholder={t(language, 'campaigns.searchPlaceholder')}
              value={campaignSearch}
              onChange={(e) => setCampaignSearch(e.target.value)}
              title={t(language, 'campaigns.searchTitleHint')}
              aria-label={t(language, 'campaigns.searchPlaceholder')}
            />
          </div>
          <button type="button" className={staffSource === 'all' ? 'primary-btn' : 'ghost-btn'} onClick={() => setStaffSource('all')}>
            {t(language, 'campaigns.staffViewAll')}
          </button>
          <button type="button" className={staffSource === 'pending' ? 'primary-btn' : 'ghost-btn'} onClick={() => setStaffSource('pending')}>
            {t(language, 'campaigns.staffViewPending')}
          </button>
        </div>
      ) : !isCustomer && (uiMode === 'uploading' || uiMode === 'tracking') ? (
        <p className="type-caption muted" style={{ marginBottom: 8 }}>
          {uiMode === 'uploading'
            ? 'عرض جميع الحملات للمراجعة — رفع المحتوى (ريل/منشور/ستوري) عبر المهام المعيّنة لك بعد اكتمال الربط.'
            : 'عرض بيانات الحملات والمزامنة مع ميتا — المهام المعروضة تخص التتبع فقط.'}
        </p>
      ) : null}

      {canReviewCampaigns && !isCustomer && staffMetaStored && (uiMode === 'full' || uiMode === 'tracking') ? (
        <SectionCard
          title="ميتا — مؤشرات مخزّنة (7 أيام)"
          description={`ملخص مزامنة الحملات (${staffMetaStored.since} → ${staffMetaStored.until}).`}
        >
          {staffMetaStored.insight_rows === 0 ? (
            <p className="muted">لا توجد صفوف مؤشرات في هذه الفترة بعد.</p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              إنفاق <strong>{currency(staffMetaStored.spend)}</strong>
              {' · '}
              ظهور {formatGroupedInt(staffMetaStored.impressions)}
              {' · '}
              نقرات {formatGroupedInt(staffMetaStored.clicks)}
              {' · '}
              تحويلات {formatGroupedInt(staffMetaStored.conversions)}
              {' · '}
              {staffMetaStored.campaigns_with_data} حملة ببيانات
            </p>
          )}
        </SectionCard>
      ) : null}

      <div className="mini-kpi-grid">
        <div className="mini-kpi">
          <small>{t(language, 'campaigns.activeCampaigns')}</small>
          <strong>{active}</strong>
        </div>
        <div className="mini-kpi">
          <small>{t(language, 'campaigns.pendingApproval')}</small>
          <strong>{pending}</strong>
        </div>
        <div className="mini-kpi">
          <small>{t(language, 'campaigns.totalClicks')}</small>
          <strong>{formatGroupedInt(totalClicks)}</strong>
        </div>
        <div className="mini-kpi">
          <small>{t(language, 'campaigns.totalSpend')}</small>
          <strong>{currency(totalSpend)}</strong>
        </div>
      </div>

      <SectionCard
        title={isCustomer ? t(language, 'campaigns.title') : t(language, 'campaigns.campaign')}
        action={
          <button type="button" className="ghost-btn" onClick={() => void load()} title={t(language, 'campaigns.refreshHint')}>
            <RefreshCw size={16} /> {t(language, 'common.refresh')}
          </button>
        }
      >
        {loading ? (
          <p className="muted">{t(language, 'common.loading')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'campaigns.campaign')}</th>
                  <th>{t(language, 'users.user')}</th>
                  <th>{t(language, 'users.status')}</th>
                  <th>{t(language, 'campaigns.clicks')}</th>
                  <th>{t(language, 'campaigns.impressions')}</th>
                  <th>{t(language, 'campaigns.spendBudget')}</th>
                  <th>{t(language, 'campaigns.period')}</th>
                  {canReviewCampaigns || showDelete || isCustomer ? <th>{t(language, 'campaigns.actions')}</th> : null}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>{campaign.name}</td>
                    <td>{isCustomer ? currentUser?.name ?? '—' : campaign.owner}</td>
                    <td>
                      <span className={campaignStatusPillClass(campaign.status)}>{statusLabel(language, campaign.status)}</span>
                    </td>
                    <td>{formatGroupedInt(campaign.clicks)}</td>
                    <td>{formatGroupedInt(campaign.impressions)}</td>
                    <td>
                      {currency(campaign.spend)} / {currency(campaign.budget)}
                    </td>
                    <td>{campaign.period || '—'}</td>
                    {canReviewCampaigns || showDelete || isCustomer ? (
                      <td>
                        <div className="row-actions">
                          {canReviewCampaigns ? (
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={busyId === campaign.id}
                              aria-label={t(language, 'campaigns.ariaCampaignDetail')}
                              onClick={() => void openStaffDetail(campaign.id)}
                            >
                              <Eye size={15} />
                            </button>
                          ) : null}
                          {showLinkingActions && campaign.status === 'pending_linking' ? (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                title={t(language, 'campaigns.tooltipCompleteMetaLink')}
                                disabled={busyId === campaign.id}
                                aria-label={t(language, 'campaigns.tooltipCompleteMetaLink')}
                                onClick={() => openCompleteLinking(campaign.id)}
                              >
                                <Link2 size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={busyId === campaign.id}
                                aria-label={t(language, 'campaigns.ariaRejectCampaign')}
                                onClick={() => openReject(campaign.id)}
                              >
                                <X size={15} />
                              </button>
                            </>
                          ) : null}
                          {showUploadApprovalActions && campaign.status === 'pending_approval' ? (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={busyId === campaign.id}
                                aria-label={t(language, 'campaigns.ariaApproveCampaign')}
                                onClick={() => void approve(campaign.id)}
                              >
                                <Check size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={busyId === campaign.id}
                                aria-label={t(language, 'campaigns.ariaRejectCampaign')}
                                onClick={() => openReject(campaign.id)}
                              >
                                <X size={15} />
                              </button>
                            </>
                          ) : null}
                          {showPauseResume && (campaign.status === 'active' || campaign.status === 'approved') ? (
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={busyId === campaign.id}
                              aria-label={t(language, 'campaigns.ariaPauseCampaign')}
                              onClick={() => void pauseCamp(campaign.id)}
                            >
                              <Pause size={15} />
                            </button>
                          ) : null}
                          {showPauseResume && campaign.status === 'paused' ? (
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={busyId === campaign.id}
                              aria-label={t(language, 'campaigns.ariaResumeCampaign')}
                              onClick={() => void resumeCamp(campaign.id)}
                            >
                              <Play size={15} />
                            </button>
                          ) : null}
                          {showSetLink && campaign.status !== 'pending_linking' ? (
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={busyId === campaign.id}
                              aria-label="Set link"
                              onClick={() => openSetLink(campaign.id)}
                            >
                              <Link2 size={15} />
                            </button>
                          ) : null}
                          {showSync ? (
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={busyId === campaign.id}
                              aria-label="Sync"
                              onClick={() => void syncStaff(campaign.id)}
                            >
                              <RefreshCw size={15} />
                            </button>
                          ) : null}
                          {isCustomer ? (
                            <>
                              <button type="button" className="icon-btn" disabled={busyId === campaign.id} onClick={() => void openCustomerShow(campaign.id)}>
                                View
                              </button>
                              <button type="button" className="icon-btn" disabled={busyId === campaign.id} onClick={() => openCustomerEdit(campaign)}>
                                {t(language, 'campaigns.actionEdit')}
                              </button>
                              <button type="button" className="icon-btn" disabled={busyId === campaign.id} onClick={() => void openInsights(campaign.id)}>
                                {t(language, 'campaigns.actionInsights')}
                              </button>
                              {campaign.meta_campaign_id ? (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title={t(language, 'campaigns.tooltipPullMetaInsights')}
                                  disabled={busyId === campaign.id}
                                  onClick={() => void pullMetaInsights(campaign.id)}
                                >
                                  {t(language, 'campaigns.actionMetaShort')}
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          {showDelete ? (
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={busyId === campaign.id}
                              aria-label={t(language, 'campaigns.deleteCampaign')}
                              onClick={() => requestRemoveCampaign(campaign.id)}
                            >
                              <Power size={15} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        title={t(language, 'campaigns.rejectTitle')}
        open={rejectOpen}
        onClose={() => {
          setRejectOpen(false)
          setRejectId(null)
        }}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setRejectOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={!rejectReason.trim() || busyId != null} onClick={() => void confirmReject()}>
              {busyId != null ? '…' : t(language, 'campaigns.submitReject')}
            </button>
          </div>
        }
      >
        <label>
          <span>{t(language, 'billing.rejectReason')}</span>
          <textarea
            className="modal-textarea"
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t(language, 'campaigns.rejectPlaceholder')}
          />
        </label>
      </Modal>

      <ConfirmDialog
        open={pendingDeleteId != null}
        title={t(language, 'campaigns.deleteCampaign')}
        message={t(language, 'campaigns.deleteConfirm')}
        confirmLabel={t(language, 'campaigns.deleteCampaign')}
        cancelLabel={t(language, 'users.cancel')}
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void confirmRemoveCampaign()}
      />

      <AlertDialog
        open={alertDialog.open}
        title={t(language, 'dialog.errorTitle')}
        message={alertDialog.message}
        okLabel={t(language, 'dialog.ok')}
        onClose={() => setAlertDialog({ open: false, message: '' })}
      />

      <Modal title={t(language, 'campaigns.staffDetailTitle')} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {staffDetail ? <CampaignStaffDetailView data={staffDetail} /> : <p className="muted">{t(language, 'campaigns.loadingDetail')}</p>}
      </Modal>

      <Modal
        title={t(language, 'campaigns.setLinkTitle')}
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setLinkOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void submitSetLink()}>
              {t(language, 'adAccounts.save')}
            </button>
          </div>
        }
      >
        <textarea
          className="modal-textarea"
          rows={3}
          value={linkValue}
          onChange={(e) => setLinkValue(e.target.value)}
          placeholder={t(language, 'campaigns.linkValuePlaceholder')}
        />
      </Modal>

      <Modal
        title={t(language, 'campaigns.completeLinkTitle')}
        open={linkingOpen}
        onClose={() => {
          setLinkingOpen(false)
          setLinkingId(null)
        }}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setLinkingOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button
              type="button"
              className="primary-btn"
              disabled={busyId != null || !linkingMeta.trim()}
              onClick={() => void submitCompleteLinking()}
            >
              {t(language, 'campaigns.activateCampaign')}
            </button>
          </div>
        }
      >
        <p className="type-caption muted" style={{ marginTop: 0 }}>
          {t(language, 'campaigns.completeLinkHint')}
        </p>
        <label>
          <span>{t(language, 'campaigns.metaLinkRequired')}</span>
          <textarea
            className="modal-textarea"
            rows={3}
            value={linkingMeta}
            onChange={(e) => setLinkingMeta(e.target.value)}
            placeholder={t(language, 'campaigns.metaLinkPlaceholder')}
          />
        </label>
        <label>
          <span>{t(language, 'campaigns.adAccountLocalIdOptional')}</span>
          <input
            type="number"
            value={linkingAdAcc}
            onChange={(e) => setLinkingAdAcc(e.target.value)}
            placeholder={t(language, 'campaigns.adAccountLocalIdPlaceholder')}
          />
        </label>
      </Modal>

      <Modal
        title={t(language, 'campaigns.createCampaignTitle')}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setCreateOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void submitCreate()}>
              {t(language, 'campaigns.submit')}
            </button>
          </div>
        }
      >
        <div className="settings-grid">
          <label>
            <span>{t(language, 'campaigns.fieldName')}</span>
            <input value={cName} onChange={(e) => setCName(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'campaigns.fieldCampaignType')}</span>
            <select value={cTypeId} onChange={(e) => setCTypeId(e.target.value)}>
              <option value="">—</option>
              {types.map((x) => (
                <option key={x.id} value={x.id}>
                  {String(x.display_name ?? x.name ?? x.id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t(language, 'campaigns.fieldAdAccount')}</span>
            <select value={cAdAcc} onChange={(e) => setCAdAcc(e.target.value)}>
              <option value="">—</option>
              {adAccounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {String(x.name ?? x.id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t(language, 'campaigns.fieldBudget')}</span>
            <input type="number" min={0.01} step="0.01" value={cBudget} onChange={(e) => setCBudget(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'campaigns.fieldDaily')}</span>
            <input type="number" min={0.01} step="0.01" value={cDaily} onChange={(e) => setCDaily(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'campaigns.fieldDescription')}</span>
            <textarea className="modal-textarea" rows={2} value={cDesc} onChange={(e) => setCDesc(e.target.value)} />
          </label>
        </div>
      </Modal>

      <Modal
        title={t(language, 'campaigns.editCampaignTitle')}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setEditOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void submitCustomerEdit()}>
              {t(language, 'adAccounts.save')}
            </button>
          </div>
        }
      >
        <div className="settings-grid">
          <label>
            <span>{t(language, 'campaigns.fieldEditName')}</span>
            <input value={eName} onChange={(e) => setEName(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'campaigns.fieldEditBudget')}</span>
            <input type="number" value={eBudget} onChange={(e) => setEBudget(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'campaigns.fieldEditDaily')}</span>
            <input type="number" value={eDaily} onChange={(e) => setEDaily(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'campaigns.fieldEditStatus')}</span>
            <select value={eStatus} onChange={(e) => setEStatus(e.target.value)}>
              <option value="pending">{statusLabel(language, 'pending')}</option>
              <option value="active">{statusLabel(language, 'active')}</option>
              <option value="paused">{statusLabel(language, 'paused')}</option>
            </select>
          </label>
        </div>
      </Modal>

      <Modal title={t(language, 'campaigns.insightsTitle')} open={insightsOpen} onClose={() => setInsightsOpen(false)}>
        {insightsData ? <CampaignInsightsView data={insightsData} /> : <p className="muted">{t(language, 'campaigns.loadingDetail')}</p>}
      </Modal>

      <Modal title={t(language, 'campaigns.custShowTitle')} open={custShowOpen} onClose={() => setCustShowOpen(false)}>
        {custShowData ? <CampaignCustomerDetailView data={custShowData} /> : <p className="muted">{t(language, 'campaigns.loadingDetail')}</p>}
      </Modal>
    </section>
  )
}
