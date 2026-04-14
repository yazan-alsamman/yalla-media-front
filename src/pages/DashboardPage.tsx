import {
  AlertTriangle,
  CircleDollarSign,
  CreditCard,
  MousePointerClick,
  Search,
  Sparkles,
  Target,
  UserRoundX,
  Wallet,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { HelpHint } from '../components/HelpHint'
import { SectionCard } from '../components/SectionCard'
import { StatCard } from '../components/StatCard'
import { activityLog } from '../data/mockData'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { campaignStatusPillClass } from '../lib/campaignStatusUi'
import { statusLabel, t } from '../i18n'
import type { Language } from '../types'
import { currency, dateLocaleWithLatinDigits, formatDateTimeForUi, formatGroupedInt } from '../utils/format'

interface SpendClicksPoint {
  month: string
  spending: number
  clicks: number
}

interface StatusSlice {
  name: string
  value: number
  color: string
}

interface AdminDashboardData {
  total_users: number
  active_campaigns: number
  pending_campaigns?: number
  total_clicks: number
  spending_this_month: number
  available_balance: number
  recent_activity?: { time: string; action: string; actor: string; amount: number | null }[]
  spend_clicks_series?: SpendClicksPoint[]
  campaign_status_distribution?: StatusSlice[]
}

interface CustomerDashboardData {
  wallet_balance: number
  pending_balance: number
  spending_this_month: number
  active_campaigns: number
  linked_accounts: number
  total_clicks: number
  spend_clicks_series?: SpendClicksPoint[]
  campaign_status_distribution?: StatusSlice[]
}

interface EmployeeDashSummary {
  pending: number
  campaignsTotal: number
  taskOpen: number
  active_campaigns?: number
}

interface MetaStoredInsightsSummary {
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

interface AccountantWidgetKpis {
  total_customer_balance: number
  pending_credit: number
  dormant_customers: number
  zero_balance_customers: number
  month_spend: number
}

interface UnifiedDashboardResponse {
  success?: boolean
  role?: string
  data?: Record<string, unknown>
}

function monthLabel(isoMonth: string, language: Language): string {
  try {
    const [y, m] = isoMonth.split('-').map(Number)
    if (!y || !m) return isoMonth
    const d = new Date(y, m - 1, 1)
    return d.toLocaleDateString(dateLocaleWithLatinDigits(language), { month: 'short', year: '2-digit' })
  } catch {
    return isoMonth
  }
}

function formatClickCount(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(Math.round(n))
}

function translateStatusSliceName(raw: string, language: Language): string {
  return statusLabel(language, raw)
}

interface ClientAlertsData {
  رصيد_صفر_أو_سالب?: unknown[]
  رصيد_منخفض?: unknown[]
  عملاء_غير_نشطين?: unknown[]
  حملات_خطر_الاستمرار?: unknown[]
}

function extractCampaignList(res: unknown): Record<string, unknown>[] {
  if (!res || typeof res !== 'object') return []
  const r = res as { data?: unknown }
  if (Array.isArray(r.data)) return r.data as Record<string, unknown>[]
  const inner = r.data as { data?: unknown }
  if (inner && typeof inner === 'object' && Array.isArray(inner.data)) return inner.data as Record<string, unknown>[]
  return []
}

interface DashboardCampaignRow {
  id: number
  name: string
  status: string
  owner: string
}

function DashboardChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="recharts-tooltip-ui">
      {label != null && label !== '' ? <p className="recharts-tooltip-ui__label">{String(label)}</p> : null}
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="recharts-tooltip-ui__row">
          <span>
            {p.color ? <span className="recharts-tooltip-ui__dot" style={{ background: p.color }} /> : null}
            {p.name}
          </span>
          <strong>{typeof p.value === 'number' ? formatGroupedInt(p.value) : String(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { campaigns, users, theme, language, role, currentUser } = useAppContext()
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null)
  const [customerData, setCustomerData] = useState<CustomerDashboardData | null>(null)
  const [employeeDash, setEmployeeDash] = useState<EmployeeDashSummary | null>(null)
  const [accountantKpis, setAccountantKpis] = useState<AccountantWidgetKpis | null>(null)
  const [metaStoredSummary, setMetaStoredSummary] = useState<MetaStoredInsightsSummary | null>(null)
  const [chartSeries, setChartSeries] = useState<SpendClicksPoint[]>([])
  const [statusPie, setStatusPie] = useState<StatusSlice[]>([])
  const [useMockFallback, setUseMockFallback] = useState(false)
  const [dashNote, setDashNote] = useState<string | null>(null)
  const [clientAlerts, setClientAlerts] = useState<ClientAlertsData | null>(null)
  const [dashCampaignRows, setDashCampaignRows] = useState<DashboardCampaignRow[]>([])
  const [dashCampLoading, setDashCampLoading] = useState(false)
  const [campaignNameQuery, setCampaignNameQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setUseMockFallback(false)
      setDashNote(null)
      setEmployeeDash(null)
      setAccountantKpis(null)
      setMetaStoredSummary(null)
      setAdminData(null)
      setCustomerData(null)
      setChartSeries([])
      setStatusPie([])
      try {
        const res = (await api.get('/dashboard')) as UnifiedDashboardResponse
        if (cancelled) return
        const apiRole = res.role ?? ''
        const d = res.data ?? {}

        const series = Array.isArray(d.spend_clicks_series) ? (d.spend_clicks_series as SpendClicksPoint[]) : []
        const pie = Array.isArray(d.campaign_status_distribution) ? (d.campaign_status_distribution as StatusSlice[]) : []

        if (apiRole === 'customer') {
          setCustomerData(d as unknown as CustomerDashboardData)
          setChartSeries(series)
          setStatusPie(pie)
          return
        }
        if (apiRole === 'admin' || apiRole === 'super_admin') {
          setAdminData(d as unknown as AdminDashboardData)
          setChartSeries(series)
          setStatusPie(pie)
          return
        }
        if (apiRole === 'employee') {
          const stats = d.tasks_stats as { open?: number } | undefined
          setEmployeeDash({
            pending: Number(d.pending_campaign_reviews ?? 0),
            campaignsTotal: Number(d.campaigns_total ?? 0),
            taskOpen: Number(stats?.open ?? 0),
            active_campaigns: Number(d.active_campaigns ?? 0),
          })
          const m = d.meta_stored_insights_summary as MetaStoredInsightsSummary | undefined
          setMetaStoredSummary(m && typeof m === 'object' ? m : null)
          setChartSeries(series)
          setStatusPie(pie)
          return
        }
        if (apiRole === 'accountant') {
          const kpis = d.kpis as AccountantWidgetKpis | undefined
          if (kpis) setAccountantKpis(kpis)
          const m = d.meta_stored_insights_summary as MetaStoredInsightsSummary | undefined
          setMetaStoredSummary(m && typeof m === 'object' ? m : null)
          setChartSeries(series)
          setStatusPie(pie)
          return
        }

        setDashNote('Unexpected role from GET /dashboard; showing fallback if available.')
      } catch (err) {
        const status = err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined
        if (status === 403 && !cancelled) {
          setUseMockFallback(true)
        }
        if (!cancelled) {
          setDashNote(
            err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Dashboard load failed',
          )
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [role])

  useEffect(() => {
    if (role !== 'admin' && role !== 'super_admin') {
      setClientAlerts(null)
      return
    }
    let c = false
    void (async () => {
      try {
        const res = (await api.get('/admin/client-alerts')) as { data?: ClientAlertsData }
        if (!c) setClientAlerts(res.data ?? null)
      } catch {
        if (!c) setClientAlerts(null)
      }
    })()
    return () => {
      c = true
    }
  }, [role])

  useEffect(() => {
    if (role === 'accountant') {
      setDashCampaignRows([])
      return
    }
    let cancelled = false
    void (async () => {
      setDashCampLoading(true)
      try {
        if (role === 'customer') {
          const res = await api.get('/customer/campaigns')
          if (cancelled) return
          setDashCampaignRows(
            extractCampaignList(res).map((raw) => ({
              id: Number(raw.id),
              name: String(raw.name ?? ''),
              status: String(raw.status ?? ''),
              owner: '—',
            })),
          )
          return
        }
        const res = await api.get('/employee/campaigns', { params: { per_page: 100 } })
        if (cancelled) return
        setDashCampaignRows(
          extractCampaignList(res).map((raw) => ({
            id: Number(raw.id),
            name: String(raw.name ?? ''),
            status: String(raw.status ?? ''),
            owner: String(raw.customer_name ?? raw.customer_email ?? '—'),
          })),
        )
      } catch {
        if (!cancelled) setDashCampaignRows([])
      } finally {
        if (!cancelled) setDashCampLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role])

  const filteredDashCampaigns = useMemo(() => {
    const q = campaignNameQuery.trim().toLowerCase()
    if (!q) return []
    return dashCampaignRows.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 20)
  }, [dashCampaignRows, campaignNameQuery])

  const mockActive = campaigns.filter((c) => c.status === 'active').length
  const mockClicks = campaigns.reduce((s, c) => s + c.clicks, 0)
  const mockSpend = campaigns.reduce((s, c) => s + c.spend, 0)
  const mockBalance = users.reduce((s, u) => s + u.balance, 0)

  const activeCampaigns =
    customerData?.active_campaigns ??
    adminData?.active_campaigns ??
    employeeDash?.active_campaigns ??
    (useMockFallback ? mockActive : 0)
  const linkedOrUsers =
    customerData?.linked_accounts ??
    adminData?.total_users ??
    (employeeDash ? employeeDash.pending : undefined) ??
    (accountantKpis ? accountantKpis.dormant_customers : undefined) ??
    (useMockFallback ? users.length : 0)
  const seriesClicksTotal = chartSeries.reduce((s, r) => s + (Number(r.clicks) || 0), 0)
  let resolvedClicks = customerData?.total_clicks ?? adminData?.total_clicks
  if (resolvedClicks === undefined || resolvedClicks === null) {
    if (role === 'employee' || role === 'accountant') {
      resolvedClicks = metaStoredSummary?.clicks ?? seriesClicksTotal
    }
  }
  if ((resolvedClicks === undefined || resolvedClicks === null) && useMockFallback) {
    resolvedClicks = mockClicks
  }
  const totalClicks = Number(resolvedClicks ?? 0)
  const spendingMonth =
    customerData?.spending_this_month ??
    adminData?.spending_this_month ??
    accountantKpis?.month_spend ??
    (useMockFallback ? mockSpend : 0)
  const availableBalance =
    customerData?.wallet_balance ??
    adminData?.available_balance ??
    accountantKpis?.total_customer_balance ??
    (useMockFallback ? mockBalance : 0)

  const lineData = useMemo(() => {
    if (useMockFallback) {
      return [
        { month: 'Jan', spending: 8000, clicks: 12400 },
        { month: 'Feb', spending: 9500, clicks: 15000 },
        { month: 'Mar', spending: 11200, clicks: 18200 },
        { month: 'Apr', spending: 10800, clicks: 16600 },
        { month: 'May', spending: 13300, clicks: 21400 },
        { month: 'Jun', spending: 12800, clicks: 22000 },
      ]
    }
    if (!chartSeries.length) return []
    return chartSeries.map((row) => ({
      month: monthLabel(row.month, language),
      spending: row.spending,
      clicks: row.clicks,
    }))
  }, [chartSeries, language, useMockFallback])

  const pieData = useMemo(() => {
    if (useMockFallback) {
      return [
        { name: t(language, 'common.active'), value: 48, color: '#1fb889' },
        { name: t(language, 'common.completed'), value: 30, color: '#3d7cf3' },
        { name: t(language, 'common.pending'), value: 16, color: '#f6b415' },
        { name: t(language, 'common.rejected'), value: 6, color: '#f35864' },
      ]
    }
    if (!statusPie.length) return []
    return statusPie.map((s) => ({
      ...s,
      name: translateStatusSliceName(s.name, language),
    }))
  }, [statusPie, language, useMockFallback])

  const gridStroke = theme === 'dark' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(124, 58, 237, 0.08)'
  const axisStroke = theme === 'dark' ? '#a89adb' : '#64748b'
  const chartPrimary = theme === 'dark' ? '#a855f7' : '#7c3aed'
  const chartSecondary = theme === 'dark' ? '#34d399' : '#059669'

  const recentRows =
    adminData?.recent_activity && adminData.recent_activity.length > 0
      ? adminData.recent_activity.map((row) => ({
          time: row.time,
          action: row.action,
          actor: row.actor,
          amount: row.amount,
        }))
      : useMockFallback
        ? activityLog.map((item) => ({
            time: item.time,
            action: item.action,
            actor: item.actor,
            amount: item.amount,
          }))
        : []

  const secondStatLabel =
    role === 'customer'
      ? t(language, 'dashboard.linkedAccounts')
      : role === 'employee'
        ? language === 'ar'
          ? 'حملات بانتظار المراجعة'
          : 'Pending campaign reviews'
        : role === 'accountant'
          ? language === 'ar'
            ? 'عملاء خاملون (+١٤ يوم)'
            : 'Dormant customers (14d+)'
          : t(language, 'nav.users')

  const chartLtr = language === 'ar' ? 'chart-ltr' : ''

  const greeting =
    currentUser?.name?.trim() != null && currentUser.name.trim() !== ''
      ? language === 'ar'
        ? `مرحباً، ${currentUser.name.trim()}`
        : `Welcome back, ${currentUser.name.trim()}`
      : t(language, 'dashboard.welcome')

  const heroChips = useMemo(() => {
    const base: { Icon: typeof Target; value: string; label: string }[] = [
      { Icon: Target, value: String(activeCampaigns), label: t(language, 'dashboard.insightLabelCampaigns') },
      { Icon: MousePointerClick, value: formatClickCount(Number(totalClicks)), label: t(language, 'dashboard.insightLabelClicks') },
      { Icon: Wallet, value: currency(availableBalance), label: t(language, 'dashboard.insightLabelBalance') },
    ]
    if (role === 'employee' && employeeDash) {
      base[1] = {
        Icon: CreditCard,
        value: String(employeeDash.pending),
        label: t(language, 'dashboard.insightLabelPendingReviews'),
      }
    }
    if (role === 'accountant' && accountantKpis) {
      base[1] = {
        Icon: CreditCard,
        value: String(accountantKpis.dormant_customers),
        label: t(language, 'dashboard.insightLabelDormant'),
      }
    }
    return base
  }, [
    activeCampaigns,
    availableBalance,
    accountantKpis,
    employeeDash,
    language,
    role,
    totalClicks,
  ])

  return (
    <section className="page-grid">
      <div className="dashboard-hero">
        <div className="dashboard-hero__inner">
          <div className="dashboard-hero__title-block">
            <div className="dashboard-hero__kicker">
              <Sparkles size={16} strokeWidth={2} aria-hidden />
              {t(language, 'dashboard.heroEyebrow')}
            </div>
            <div className="page-title" style={{ marginBottom: 0 }}>
              <h2>{greeting}</h2>
              <p>{t(language, 'dashboard.subtitle')}</p>
            </div>
          </div>
          <div className="dashboard-hero__insights" aria-label={t(language, 'dashboard.heroEyebrow')}>
            {heroChips.map(({ Icon, value, label }) => (
              <div key={label} className="dashboard-hero__chip">
                <Icon size={18} strokeWidth={1.75} aria-hidden />
                <div className="dashboard-hero__chip-stat">
                  <strong>{value}</strong>
                  <small>{label}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {useMockFallback ? (
        <p className="muted" style={{ marginTop: -8 }}>
          {language === 'ar'
            ? 'عرض ملخص تقريبي — سجّل الدخول كمشرف للوصول إلى لوحة الإدارة الكاملة.'
            : 'Showing preview metrics — sign in as Admin or Super Admin for full organization dashboard data.'}
        </p>
      ) : null}
      {dashNote ? (
        <p className="login-error" style={{ marginTop: -8 }}>
          {dashNote}
        </p>
      ) : null}

      {role !== 'accountant' ? (
        <SectionCard title={t(language, 'dashboard.campaignSearchTitle')} description={t(language, 'dashboard.campaignSearchHint')}>
          <div className="search-field" style={{ maxWidth: 420, marginBottom: 12 }}>
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={campaignNameQuery}
              onChange={(e) => setCampaignNameQuery(e.target.value)}
              placeholder={t(language, 'dashboard.campaignSearchPlaceholder')}
              aria-label={t(language, 'dashboard.campaignSearchPlaceholder')}
            />
          </div>
          {dashCampLoading ? (
            <p className="muted">{t(language, 'dashboard.campaignSearchLoading')}</p>
          ) : campaignNameQuery.trim() === '' ? (
            <p className="muted">{t(language, 'dashboard.campaignSearchIdle')}</p>
          ) : filteredDashCampaigns.length === 0 ? (
            <p className="muted">{t(language, 'dashboard.campaignSearchEmpty')}</p>
          ) : (
            <ul className="plain-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {filteredDashCampaigns.map((c) => (
                <li key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      textAlign: language === 'ar' ? 'right' : 'left',
                      padding: '12px 8px',
                      height: 'auto',
                      alignItems: 'flex-start',
                    }}
                    onClick={() => navigate(`/campaigns?q=${encodeURIComponent(c.name)}`)}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: language === 'ar' ? 'flex-end' : 'flex-start' }}>
                      <strong>{c.name}</strong>
                      {c.owner !== '—' ? <span className="type-caption muted">{c.owner}</span> : null}
                    </span>
                    <span className={campaignStatusPillClass(c.status)} style={{ flexShrink: 0, marginInlineStart: 8 }}>
                      {statusLabel(language, c.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : (
        <SectionCard title={t(language, 'dashboard.campaignSearchTitle')}>
          <p className="muted">{t(language, 'dashboard.campaignSearchUnavailable')}</p>
        </SectionCard>
      )}

      {(role === 'admin' || role === 'super_admin') && clientAlerts ? (
        <SectionCard title={t(language, 'dashboard.alertsTitle')} description={t(language, 'dashboard.alertsSubtitle')}>
          <HelpHint
            language={language}
            titleKey="dashboard.alertsHelpTitle"
            whatKey="dashboard.alertsHelpWhat"
            whyKey="dashboard.alertsHelpWhy"
            howKey="dashboard.alertsHelpHow"
          />
          <div className="client-alerts-grid">
            <div className="client-alert-tile client-alert-tile--risk">
              <span className="client-alert-tile__icon" aria-hidden>
                <AlertTriangle size={20} strokeWidth={1.75} />
              </span>
              <div>
                <p className="client-alert-tile__label">{t(language, 'dashboard.alertTileZero')}</p>
                <p className="client-alert-tile__value">{Array.isArray(clientAlerts.رصيد_صفر_أو_سالب) ? clientAlerts.رصيد_صفر_أو_سالب.length : 0}</p>
              </div>
            </div>
            <div className="client-alert-tile client-alert-tile--warn">
              <span className="client-alert-tile__icon" aria-hidden>
                <Wallet size={20} strokeWidth={1.75} />
              </span>
              <div>
                <p className="client-alert-tile__label">{t(language, 'dashboard.alertTileLow')}</p>
                <p className="client-alert-tile__value">{Array.isArray(clientAlerts.رصيد_منخفض) ? clientAlerts.رصيد_منخفض.length : 0}</p>
              </div>
            </div>
            <div className="client-alert-tile client-alert-tile--warn">
              <span className="client-alert-tile__icon" aria-hidden>
                <Target size={20} strokeWidth={1.75} />
              </span>
              <div>
                <p className="client-alert-tile__label">{t(language, 'dashboard.alertTileCampaignRisk')}</p>
                <p className="client-alert-tile__value">
                  {Array.isArray(clientAlerts.حملات_خطر_الاستمرار) ? clientAlerts.حملات_خطر_الاستمرار.length : 0}
                </p>
              </div>
            </div>
            <div className="client-alert-tile client-alert-tile--info">
              <span className="client-alert-tile__icon" aria-hidden>
                <UserRoundX size={20} strokeWidth={1.75} />
              </span>
              <div>
                <p className="client-alert-tile__label">{t(language, 'dashboard.alertTileInactive')}</p>
                <p className="client-alert-tile__value">{Array.isArray(clientAlerts.عملاء_غير_نشطين) ? clientAlerts.عملاء_غير_نشطين.length : 0}</p>
              </div>
            </div>
          </div>
          {Array.isArray(clientAlerts.حملات_خطر_الاستمرار) && clientAlerts.حملات_خطر_الاستمرار.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <p className="type-caption muted" style={{ marginBottom: 8 }}>
                {t(language, 'dashboard.alertCampaignRiskHint')}
              </p>
              <ul className="plain-list" style={{ margin: 0, padding: 0, listStyle: 'none', maxHeight: 220, overflow: 'auto' }}>
                {(clientAlerts.حملات_خطر_الاستمرار as Record<string, unknown>[]).slice(0, 12).map((row, idx) => (
                  <li
                    key={`${String(row.campaign_id ?? idx)}`}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      padding: '10px 0',
                      display: 'flex',
                      flexDirection: language === 'ar' ? 'row-reverse' : 'row',
                      justifyContent: 'space-between',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{String(row.اسم_الحملة ?? row.campaign_id ?? '—')}</span>
                    <span className="muted type-caption">
                      {String(row.العميل ?? '')}
                      {row.رصيد_المحفظة != null && row.الميزانية_اليومية != null
                        ? ` · ${String(row.رصيد_المحفظة)} / ${String(row.الميزانية_اليومية)}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : Array.isArray(clientAlerts.حملات_خطر_الاستمرار) && clientAlerts.حملات_خطر_الاستمرار.length === 0 ? (
            <p className="muted type-caption" style={{ marginTop: 12 }}>
              {t(language, 'dashboard.alertCampaignRiskEmpty')}
            </p>
          ) : null}
        </SectionCard>
      ) : null}
      {role === 'employee' && employeeDash ? (
        <p className="type-caption" style={{ marginTop: -4 }}>
          {language === 'ar' ? 'مؤشرات الفريق من الخادم.' : 'Team metrics are aggregated on the server.'}
        </p>
      ) : null}
      {role === 'accountant' && accountantKpis ? (
        <p className="type-caption" style={{ marginTop: -4 }}>
          {language === 'ar' ? 'مؤشرات مالية من لوحة التحكم الموحدة.' : 'Financial KPIs from your unified dashboard feed.'}
        </p>
      ) : null}

      <div className="stats-grid">
        <StatCard
          title={t(language, 'dashboard.activeCampaigns')}
          value={String(activeCampaigns)}
          trend={useMockFallback ? t(language, 'dashboard.trendUp1') : null}
          icon={Target}
        />
        <StatCard
          title={secondStatLabel}
          value={String(linkedOrUsers)}
          trend={useMockFallback ? t(language, 'dashboard.trendUp2') : null}
          icon={CreditCard}
        />
        <StatCard
          title={t(language, 'dashboard.totalClicks')}
          value={formatClickCount(Number(totalClicks))}
          trend={useMockFallback ? t(language, 'dashboard.trendUp3') : null}
          icon={MousePointerClick}
        />
        <StatCard
          title={t(language, 'dashboard.spendingMonth')}
          value={currency(spendingMonth)}
          trend={useMockFallback ? t(language, 'dashboard.trendDown') : null}
          icon={CircleDollarSign}
        />
        <StatCard
          title={t(language, 'dashboard.availableBalance')}
          value={currency(availableBalance)}
          trend={useMockFallback ? t(language, 'dashboard.trendUp4') : null}
          icon={Wallet}
        />
      </div>

      {(role === 'employee' || role === 'accountant') && metaStoredSummary ? (
        <SectionCard
          title={role === 'accountant' ? 'Meta campaign spend (stored)' : 'Meta ads — stored insights'}
          description={`Last ${metaStoredSummary.days} days (${metaStoredSummary.since} → ${metaStoredSummary.until}). Data from synced campaign_insights in Yalla, not a live Meta request.`}
        >
          {metaStoredSummary.insight_rows === 0 ? (
            <p className="muted">No stored insight rows yet. Customers sync from Meta on the Integrations page.</p>
          ) : (
            <dl className="detail-grid" style={{ marginTop: 0 }}>
              <div className="detail-row">
                <dt>Spend</dt>
                <dd>{currency(metaStoredSummary.spend)}</dd>
              </div>
              <div className="detail-row">
                <dt>Impressions</dt>
                <dd>{formatGroupedInt(metaStoredSummary.impressions)}</dd>
              </div>
              <div className="detail-row">
                <dt>Clicks</dt>
                <dd>{formatGroupedInt(metaStoredSummary.clicks)}</dd>
              </div>
              <div className="detail-row">
                <dt>Conversions (offsite)</dt>
                <dd>{formatGroupedInt(metaStoredSummary.conversions)}</dd>
              </div>
              <div className="detail-row">
                <dt>Campaigns with data</dt>
                <dd>{metaStoredSummary.campaigns_with_data}</dd>
              </div>
            </dl>
          )}
        </SectionCard>
      ) : null}

      <div className={`chart-grid ${chartLtr}`.trim()}>
        <SectionCard title={t(language, 'dashboard.spendingClicks')}>
          <div className="chart-wrap">
            {lineData.length === 0 && !useMockFallback ? (
              <p className="muted" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {language === 'ar' ? 'لا توجد بيانات كافية للرسم بعد.' : 'Not enough data to plot this chart yet.'}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 6" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="month" stroke={axisStroke} tickLine={false} axisLine={{ stroke: gridStroke }} tick={{ fontSize: 12 }} />
                  <YAxis
                    stroke={axisStroke}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                    width={48}
                    tickFormatter={(v) => formatGroupedInt(Number(v))}
                  />
                  <Tooltip content={DashboardChartTooltip} cursor={{ stroke: chartPrimary, strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="spending"
                    name={language === 'ar' ? 'الإنفاق' : 'Spending'}
                    stroke={chartPrimary}
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 2, fill: theme === 'dark' ? '#1a1028' : '#ffffff' }}
                    activeDot={{ r: 6 }}
                    isAnimationActive
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    name={language === 'ar' ? 'النقرات' : 'Clicks'}
                    stroke={chartSecondary}
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 2, fill: theme === 'dark' ? '#1a1028' : '#ffffff' }}
                    activeDot={{ r: 6 }}
                    isAnimationActive
                    animationDuration={700}
                    animationEasing="ease-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard title={t(language, 'dashboard.statusDistribution')}>
          <div className="chart-wrap chart-wrap--tall">
            {pieData.length === 0 && !useMockFallback ? (
              <p className="muted" style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {language === 'ar' ? 'لا حملات لعرض التوزيع بعد.' : 'No campaigns yet to show status distribution.'}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={88}
                    innerRadius={28}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    isAnimationActive
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={DashboardChartTooltip} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title={t(language, 'dashboard.recentTransactions')}>
        <div className="table-wrap">
          {recentRows.length === 0 ? (
            <p className="muted">{language === 'ar' ? 'لا نشاط محفظة حديث لعرضه.' : 'No recent wallet activity to show.'}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'dashboard.time')}</th>
                  <th>{t(language, 'dashboard.action')}</th>
                  <th>{t(language, 'dashboard.actor')}</th>
                  <th>{t(language, 'dashboard.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((item, i) => (
                  <tr key={`${item.time}-${item.actor}-${i}`}>
                    <td>
                      {item.time.includes('T')
                        ? formatDateTimeForUi(language, new Date(item.time))
                        : item.time}
                    </td>
                    <td>
                      {item.action === 'Top-up credit' || item.action === 'deposit'
                        ? t(language, 'activity.topup')
                        : item.action === 'Campaign accepted' || item.action === 'campaign_spend'
                          ? t(language, 'activity.accepted')
                          : item.action === 'Balance adjustment' || item.action === 'adjustment'
                            ? t(language, 'activity.adjusted')
                            : item.action === 'withdrawal'
                              ? item.action
                              : t(language, 'activity.uploaded')}
                    </td>
                    <td>{item.actor}</td>
                    <td>{item.amount != null ? currency(item.amount) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>
    </section>
  )
}
