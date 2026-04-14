import { Calendar, HelpCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ExplainPanels } from '../components/ExplainPanels'
import { ExplainToggle } from '../components/ExplainToggle'
import { HelpHint } from '../components/HelpHint'
import { SkeletonLine } from '../components/Skeleton'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { parseDailyReportPayload } from '../lib/parseDailyReportPayload'
import { t, statusLabel } from '../i18n'
import type { Language } from '../types'
import { currency, formatCompactCount, formatDateTimeForUi, formatGroupedInt } from '../utils/format'

function formatDateTime(iso: string, language: Language) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return formatDateTimeForUi(language, d)
  } catch {
    return iso
  }
}

function fmtInt(_language: Language, n: number) {
  return formatGroupedInt(n)
}

const P = {
  dashboard: '/dashboard',
  users: '/users',
  campaigns: '/campaigns',
  campaignTracking: '/campaign-tracking',
  tasks: '/tasks',
  billing: '/billing',
  accountRequests: '/account-requests',
  adAccounts: '/ad-accounts',
  bills: '/bills',
  operationsPulse: '/operations-pulse',
} as const

function campaignsByStatusHref(statusKey: string) {
  const s = statusKey.trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_')
  return `${P.campaigns}?status=${encodeURIComponent(s)}`
}

export function DailyReportPage() {
  const { language } = useAppContext()
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.get('/admin/daily-report', { params: { date: reportDate } })) as {
        data?: Record<string, unknown>
      }
      setRaw(res.data && typeof res.data === 'object' ? (res.data as Record<string, unknown>) : {})
    } catch {
      setRaw(null)
    } finally {
      setLoading(false)
    }
  }, [reportDate])

  useEffect(() => {
    void load()
  }, [load])

  const parsed = useMemo(() => parseDailyReportPayload(raw), [raw])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = (await api.post('/admin/daily-report/regenerate', { date: reportDate })) as {
        data?: Record<string, unknown>
      }
      if (res.data && typeof res.data === 'object') {
        setRaw(res.data as Record<string, unknown>)
      } else {
        await load()
      }
    } catch {
      await load()
    } finally {
      setRefreshing(false)
    }
  }

  const maxDate = useMemo(() => new Date().toISOString().slice(0, 10), [])

  type MetricProps = {
    labelKey: string
    whatKey: string
    whyKey: string
    howKey: string
    value: string
    tone?: 'default' | 'warn' | 'hot'
    navigateTo?: string
  }

  function MetricRow({ labelKey, whatKey, whyKey, howKey, value, tone = 'default', navigateTo }: MetricProps) {
    const [explainOpen, setExplainOpen] = useState(false)
    const main = (
      <div className="daily-metric-row__main">
        <div className="daily-metric-row__labelwrap">
          <span className="daily-metric-row__label">{t(language, labelKey)}</span>
          {tone === 'hot' ? (
            <span className="daily-metric-row__flair" title={t(language, 'dailyReport.flairHot')} aria-hidden>
              🔥
            </span>
          ) : null}
          {tone === 'warn' ? (
            <span className="daily-metric-row__flair daily-metric-row__flair--warn" aria-hidden>
              ⚠️
            </span>
          ) : null}
        </div>
        <span className="daily-metric-row__value">{value}</span>
      </div>
    )
    return (
      <div className={`daily-metric-row daily-metric-row--${tone} ${navigateTo ? 'daily-metric-row--has-link' : ''}`}>
        <div className="daily-metric-row__line">
          {navigateTo ? (
            <Link
              className="daily-metric-row__link"
              to={navigateTo}
              aria-label={`${t(language, labelKey)} — ${t(language, 'dailyReport.goToRelated')}`}
            >
              {main}
            </Link>
          ) : (
            main
          )}
          <button
            type="button"
            className="explain-toggle__icon-btn"
            aria-expanded={explainOpen}
            aria-label={t(language, 'help.explainChip')}
            onClick={() => setExplainOpen((v) => !v)}
          >
            <HelpCircle size={16} aria-hidden />
          </button>
        </div>
        {explainOpen ? (
          <div className="daily-metric-row__panels">
            <ExplainPanels language={language} whatKey={whatKey} whyKey={whyKey} howKey={howKey} size="compact" />
          </div>
        ) : null}
      </div>
    )
  }

  type SectionAccent = 'when' | 'meta' | 'campaigns' | 'growth' | 'pipeline' | 'balances' | 'ops'

  type SectionProps = {
    titleKey: string
    helpLabelKey: string
    sectionWhat: string
    sectionWhy: string
    sectionHow: string
    accent: SectionAccent
    sectionTo?: string
    children: ReactNode
  }

  function ReportSection({
    titleKey,
    helpLabelKey,
    sectionWhat,
    sectionWhy,
    sectionHow,
    accent,
    sectionTo,
    children,
  }: SectionProps) {
    return (
      <section className={`daily-report-section daily-report-section--${accent}`}>
        <header className="daily-report-section__head">
          <h3 className="daily-report-section__title">
            {sectionTo ? (
              <Link
                to={sectionTo}
                className="daily-report-section__title-link"
                aria-label={`${t(language, titleKey)} — ${t(language, 'dailyReport.goToRelated')}`}
              >
                {t(language, titleKey)}
              </Link>
            ) : (
              t(language, titleKey)
            )}
          </h3>
          <ExplainToggle
            language={language}
            labelKey={helpLabelKey}
            whatKey={sectionWhat}
            whyKey={sectionWhy}
            howKey={sectionHow}
            size="compact"
          />
        </header>
        <div className="daily-report-section__body">{children}</div>
      </section>
    )
  }

  const statusEntries = useMemo(() => {
    if (!parsed) return []
    return Object.entries(parsed.campaignsByStatus).sort((a, b) => b[1] - a[1])
  }, [parsed])

  return (
    <section className="page-grid daily-report-page">
      <div className="daily-report-masthead">
        <div className="daily-report-masthead__glow" aria-hidden />
        <p className="daily-report-masthead__kicker">{t(language, 'dailyReport.mastheadKicker')}</p>
        <p className="daily-report-masthead__soul">{t(language, 'dailyReport.mastheadSoul')}</p>
      </div>

      <div className="page-title page-title--warm daily-report-page-head">
        <div>
          <h2>{t(language, 'dailyReport.title')}</h2>
          <p className="daily-report-page-head__lead">{t(language, 'dailyReport.subtitle')}</p>
        </div>
        <div className="daily-report-date-row">
          <label className="daily-report-date-label">
            <Calendar size={16} aria-hidden />
            <span className="type-caption">{t(language, 'dailyReport.pickDate')}</span>
            <input
              type="date"
              className="daily-report-date-input"
              value={reportDate}
              max={maxDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </label>
        </div>
      </div>

      <HelpHint
        language={language}
        titleKey="dailyReport.helpTitle"
        whatKey="dailyReport.helpWhat"
        whyKey="dailyReport.helpWhy"
        howKey="dailyReport.helpHow"
      />

      <div className="daily-report-actions">
        <button type="button" className="primary-btn daily-report-refresh" disabled={loading || refreshing} onClick={() => void handleRefresh()}>
          {refreshing ? t(language, 'dailyReport.refreshing') : t(language, 'dailyReport.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="daily-report-board daily-report-board--loading">
          <SkeletonLine />
          <SkeletonLine />
        </div>
      ) : !parsed ? (
        <p className="muted">{t(language, 'dailyReport.empty')}</p>
      ) : (
        <div className="daily-report-board">
          <div className="daily-report-hero" aria-label={t(language, 'dailyReport.heroAria')}>
            <NavLink
              to={P.users}
              className="stat-card daily-report-stat daily-report-stat--customers daily-report-stat--link"
              aria-label={`${t(language, 'dailyReport.heroTotalCustomers')} — ${t(language, 'dailyReport.goToRelated')}`}
            >
              <div className="stat-card__label">{t(language, 'dailyReport.heroTotalCustomers')}</div>
              <div className="stat-card__value">{fmtInt(language, parsed.totalCustomers)}</div>
            </NavLink>
            <NavLink
              to={P.campaigns}
              className="stat-card daily-report-stat daily-report-stat--campaigns daily-report-stat--link"
              aria-label={`${t(language, 'dailyReport.heroTotalCampaigns')} — ${t(language, 'dailyReport.goToRelated')}`}
            >
              <div className="stat-card__label">{t(language, 'dailyReport.heroTotalCampaigns')}</div>
              <div className="stat-card__value">{fmtInt(language, parsed.totalCampaigns)}</div>
            </NavLink>
            <NavLink
              to={P.dashboard}
              className="stat-card daily-report-stat daily-report-stat--spark daily-report-stat--link"
              aria-label={`${t(language, 'dailyReport.heroNewToday')} — ${t(language, 'dailyReport.goToRelated')}`}
            >
              <div className="stat-card__label">{t(language, 'dailyReport.heroNewToday')}</div>
              <div className="stat-card__value">
                {fmtInt(language, parsed.newUsers)} / {fmtInt(language, parsed.newCampaigns)}
              </div>
              <div className="type-caption daily-report-stat__caption">
                {t(language, 'dailyReport.heroNewTodaySub')}
              </div>
            </NavLink>
            <NavLink
              to={P.campaignTracking}
              className="stat-card daily-report-stat daily-report-stat--meta daily-report-stat--link"
              aria-label={`${t(language, 'dailyReport.heroMetaDay')} — ${t(language, 'dailyReport.goToRelated')}`}
            >
              <div className="stat-card__label">{t(language, 'dailyReport.heroMetaDay')}</div>
              <div className="stat-card__value">{currency(parsed.metaDaySpend)}</div>
              <div className="type-caption daily-report-stat__caption">
                {formatCompactCount(parsed.metaDayClicks)} {t(language, 'dailyReport.heroClicks')} ·{' '}
                {formatCompactCount(parsed.metaDayImpressions)} {t(language, 'dailyReport.heroImpressions')}
              </div>
            </NavLink>
            <NavLink
              to={P.tasks}
              className="stat-card daily-report-stat daily-report-stat--tasks daily-report-stat--link"
              aria-label={`${t(language, 'dailyReport.heroOpenTasks')} — ${t(language, 'dailyReport.goToRelated')}`}
            >
              <div className="stat-card__label">{t(language, 'dailyReport.heroOpenTasks')}</div>
              <div className="stat-card__value">{fmtInt(language, parsed.incompleteTasks)}</div>
            </NavLink>
            <NavLink
              to={P.billing}
              className="stat-card daily-report-stat daily-report-stat--finance daily-report-stat--link"
              aria-label={`${t(language, 'dailyReport.heroPendingTopUps')} — ${t(language, 'dailyReport.goToRelated')}`}
            >
              <div className="stat-card__label">{t(language, 'dailyReport.heroPendingTopUps')}</div>
              <div className="stat-card__value">{fmtInt(language, parsed.pendingTopUps)}</div>
            </NavLink>
          </div>

          <ReportSection
            titleKey="dailyReport.sectionWhen"
            helpLabelKey="dailyReport.sectionWhenHelpTitle"
            sectionWhat="dailyReport.sectionWhenWhat"
            sectionWhy="dailyReport.sectionWhenWhy"
            sectionHow="dailyReport.sectionWhenHow"
            accent="when"
          >
            <MetricRow
              labelKey="dailyReport.metricDate"
              whatKey="dailyReport.metricDateWhat"
              whyKey="dailyReport.metricDateWhy"
              howKey="dailyReport.metricDateHow"
              value={parsed.date || '—'}
            />
            <MetricRow
              labelKey="dailyReport.metricGenerated"
              whatKey="dailyReport.metricGeneratedWhat"
              whyKey="dailyReport.metricGeneratedWhy"
              howKey="dailyReport.metricGeneratedHow"
              value={formatDateTime(parsed.generatedAt, language)}
            />
          </ReportSection>

          <ReportSection
            titleKey="dailyReport.sectionMetaDay"
            helpLabelKey="dailyReport.sectionMetaDayHelpTitle"
            sectionWhat="dailyReport.sectionMetaDayWhat"
            sectionWhy="dailyReport.sectionMetaDayWhy"
            sectionHow="dailyReport.sectionMetaDayHow"
            accent="meta"
            sectionTo={P.campaignTracking}
          >
            <MetricRow
              labelKey="dailyReport.metricMetaSpend"
              whatKey="dailyReport.metricMetaSpendWhat"
              whyKey="dailyReport.metricMetaSpendWhy"
              howKey="dailyReport.metricMetaSpendHow"
              value={currency(parsed.metaDaySpend)}
              navigateTo={P.campaignTracking}
            />
            <MetricRow
              labelKey="dailyReport.metricMetaClicks"
              whatKey="dailyReport.metricMetaClicksWhat"
              whyKey="dailyReport.metricMetaClicksWhy"
              howKey="dailyReport.metricMetaClicksHow"
              value={fmtInt(language, parsed.metaDayClicks)}
              navigateTo={P.campaignTracking}
            />
            <MetricRow
              labelKey="dailyReport.metricMetaImpressions"
              whatKey="dailyReport.metricMetaImpressionsWhat"
              whyKey="dailyReport.metricMetaImpressionsWhy"
              howKey="dailyReport.metricMetaImpressionsHow"
              value={fmtInt(language, parsed.metaDayImpressions)}
              navigateTo={P.campaignTracking}
            />
          </ReportSection>

          <ReportSection
            titleKey="dailyReport.sectionCampaigns"
            helpLabelKey="dailyReport.sectionCampaignsHelpTitle"
            sectionWhat="dailyReport.sectionCampaignsWhat"
            sectionWhy="dailyReport.sectionCampaignsWhy"
            sectionHow="dailyReport.sectionCampaignsHow"
            accent="campaigns"
            sectionTo={P.campaigns}
          >
            {statusEntries.length === 0 ? (
              <p className="muted type-caption">{t(language, 'dailyReport.noStatusBreakdown')}</p>
            ) : (
              <div className="daily-report-status-grid">
                {statusEntries.map(([st, count]) => {
                  const dataStatus = st.trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_')
                  return (
                    <NavLink
                      key={st}
                      to={campaignsByStatusHref(st)}
                      className="daily-report-status-pill daily-report-status-pill--link"
                      data-status={dataStatus}
                      aria-label={`${statusLabel(language, st)} — ${t(language, 'dailyReport.goToRelated')}`}
                    >
                      <span className="daily-report-status-pill__label">{statusLabel(language, st)}</span>
                      <span className="daily-report-status-pill__value">{fmtInt(language, count)}</span>
                    </NavLink>
                  )
                })}
              </div>
            )}
          </ReportSection>

          <ReportSection
            titleKey="dailyReport.sectionGrowth"
            helpLabelKey="dailyReport.sectionGrowthHelpTitle"
            sectionWhat="dailyReport.sectionGrowthWhat"
            sectionWhy="dailyReport.sectionGrowthWhy"
            sectionHow="dailyReport.sectionGrowthHow"
            accent="growth"
            sectionTo={P.dashboard}
          >
            <MetricRow
              labelKey="dailyReport.metricNewUsers"
              whatKey="dailyReport.metricNewUsersWhat"
              whyKey="dailyReport.metricNewUsersWhy"
              howKey="dailyReport.metricNewUsersHow"
              value={fmtInt(language, parsed.newUsers)}
              navigateTo={P.users}
            />
            <MetricRow
              labelKey="dailyReport.metricNewCampaigns"
              whatKey="dailyReport.metricNewCampaignsWhat"
              whyKey="dailyReport.metricNewCampaignsWhy"
              howKey="dailyReport.metricNewCampaignsHow"
              value={fmtInt(language, parsed.newCampaigns)}
              navigateTo={P.campaigns}
            />
          </ReportSection>

          <ReportSection
            titleKey="dailyReport.sectionPipeline"
            helpLabelKey="dailyReport.sectionPipelineHelpTitle"
            sectionWhat="dailyReport.sectionPipelineWhat"
            sectionWhy="dailyReport.sectionPipelineWhy"
            sectionHow="dailyReport.sectionPipelineHow"
            accent="pipeline"
            sectionTo={P.operationsPulse}
          >
            <MetricRow
              labelKey="dailyReport.metricSubPending"
              whatKey="dailyReport.metricSubPendingWhat"
              whyKey="dailyReport.metricSubPendingWhy"
              howKey="dailyReport.metricSubPendingHow"
              value={fmtInt(language, parsed.accountRequestsPending)}
              tone={parsed.accountRequestsPending > 0 ? 'warn' : 'default'}
              navigateTo={P.accountRequests}
            />
            <MetricRow
              labelKey="dailyReport.metricAdPending"
              whatKey="dailyReport.metricAdPendingWhat"
              whyKey="dailyReport.metricAdPendingWhy"
              howKey="dailyReport.metricAdPendingHow"
              value={`${fmtInt(language, parsed.adAccountsPendingLink)} / ${fmtInt(language, parsed.adAccountsTotal)}`}
              navigateTo={P.adAccounts}
            />
            <MetricRow
              labelKey="dailyReport.metricInvoicesUnpaid"
              whatKey="dailyReport.metricInvoicesUnpaidWhat"
              whyKey="dailyReport.metricInvoicesUnpaidWhy"
              howKey="dailyReport.metricInvoicesUnpaidHow"
              value={fmtInt(language, parsed.invoicesUnpaid)}
              tone={parsed.invoicesUnpaid > 0 ? 'warn' : 'default'}
              navigateTo={P.bills}
            />
            <MetricRow
              labelKey="dailyReport.metricTxToday"
              whatKey="dailyReport.metricTxTodayWhat"
              whyKey="dailyReport.metricTxTodayWhy"
              howKey="dailyReport.metricTxTodayHow"
              value={fmtInt(language, parsed.transactionsToday)}
              navigateTo={P.billing}
            />
          </ReportSection>

          <ReportSection
            titleKey="dailyReport.sectionBalances"
            helpLabelKey="dailyReport.sectionBalancesHelpTitle"
            sectionWhat="dailyReport.sectionBalancesWhat"
            sectionWhy="dailyReport.sectionBalancesWhy"
            sectionHow="dailyReport.sectionBalancesHow"
            accent="balances"
            sectionTo={P.billing}
          >
            <MetricRow
              labelKey="dailyReport.metricTotalBalances"
              whatKey="dailyReport.metricTotalBalancesWhat"
              whyKey="dailyReport.metricTotalBalancesWhy"
              howKey="dailyReport.metricTotalBalancesHow"
              value={currency(parsed.totalCustomerBalances)}
              navigateTo={P.billing}
            />
            <MetricRow
              labelKey="dailyReport.metricZeroWallets"
              whatKey="dailyReport.metricZeroWalletsWhat"
              whyKey="dailyReport.metricZeroWalletsWhy"
              howKey="dailyReport.metricZeroWalletsHow"
              value={fmtInt(language, parsed.zeroOrLessWallets)}
              tone={parsed.zeroOrLessWallets > 0 ? 'warn' : 'default'}
              navigateTo={P.billing}
            />
            <MetricRow
              labelKey="dailyReport.metricLowBalance"
              whatKey="dailyReport.metricLowBalanceWhat"
              whyKey="dailyReport.metricLowBalanceWhy"
              howKey="dailyReport.metricLowBalanceHow"
              value={fmtInt(language, parsed.lowBalanceWallets)}
              tone={parsed.lowBalanceWallets > 0 ? 'warn' : 'default'}
              navigateTo={P.billing}
            />
          </ReportSection>

          <ReportSection
            titleKey="dailyReport.sectionOps"
            helpLabelKey="dailyReport.sectionOpsHelpTitle"
            sectionWhat="dailyReport.sectionOpsWhat"
            sectionWhy="dailyReport.sectionOpsWhy"
            sectionHow="dailyReport.sectionOpsHow"
            accent="ops"
            sectionTo={P.tasks}
          >
            <MetricRow
              labelKey="dailyReport.metricNegative"
              whatKey="dailyReport.metricNegativeWhat"
              whyKey="dailyReport.metricNegativeWhy"
              howKey="dailyReport.metricNegativeHow"
              value={fmtInt(language, parsed.negativeBalanceAccounts)}
              tone={parsed.negativeBalanceAccounts > 0 ? 'hot' : 'default'}
              navigateTo={P.billing}
            />
            <MetricRow
              labelKey="dailyReport.metricOpenTasks"
              whatKey="dailyReport.metricOpenTasksWhat"
              whyKey="dailyReport.metricOpenTasksWhy"
              howKey="dailyReport.metricOpenTasksHow"
              value={fmtInt(language, parsed.incompleteTasks)}
              tone={parsed.incompleteTasks > 0 ? 'hot' : 'default'}
              navigateTo={P.tasks}
            />
            <MetricRow
              labelKey="dailyReport.metricPendingTopUps"
              whatKey="dailyReport.metricPendingTopUpsWhat"
              whyKey="dailyReport.metricPendingTopUpsWhy"
              howKey="dailyReport.metricPendingTopUpsHow"
              value={fmtInt(language, parsed.pendingTopUps)}
              tone={parsed.pendingTopUps > 0 ? 'hot' : 'default'}
              navigateTo={P.billing}
            />
          </ReportSection>
        </div>
      )}
    </section>
  )
}
