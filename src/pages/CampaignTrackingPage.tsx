import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { SectionCard } from '../components/SectionCard'
import { HelpHint } from '../components/HelpHint'
import { SkeletonLine } from '../components/Skeleton'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import type { Language } from '../types'
import { t, statusLabel } from '../i18n'
import { formatAdSpend, formatCompactCount, formatGroupedInt } from '../utils/format'

type CampaignRow = Record<string, unknown>

type MetricKey = 'spend' | 'clicks' | 'ctr'

type ListMeta = { current_page: number; last_page: number; per_page: number; total: number }

const PER_PAGE = 100

const STATUS_FILTERS = [
  '',
  'active',
  'paused',
  'draft',
  'pending_approval',
  'pending_linking',
  'approved',
  'rejected',
  'completed',
  'cancelled',
] as const

function extractRows(res: unknown): CampaignRow[] {
  if (!res || typeof res !== 'object') return []
  const r = res as { data?: unknown }
  if (Array.isArray(r.data)) return r.data as CampaignRow[]
  const inner = r.data as { data?: unknown }
  if (inner && typeof inner === 'object' && Array.isArray(inner.data)) return inner.data as CampaignRow[]
  return []
}

function extractMeta(res: unknown): ListMeta | null {
  if (!res || typeof res !== 'object') return null
  const m = (res as { meta?: unknown }).meta
  if (!m || typeof m !== 'object') return null
  const x = m as Record<string, unknown>
  return {
    current_page: Number(x.current_page) || 1,
    last_page: Number(x.last_page) || 1,
    per_page: Number(x.per_page) || PER_PAGE,
    total: Number(x.total) || 0,
  }
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function ctrDisplay(impressions: unknown, clicks: unknown): string {
  const imp = num(impressions)
  const clk = num(clicks)
  if (imp <= 0) return '—'
  return `${((clk / imp) * 100).toFixed(1)}%`
}

function statusPillClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'approved') return 'pill pill--green'
  if (s === 'paused' || s === 'pending_linking' || s === 'pending_approval') return 'pill pill--amber'
  if (s === 'rejected' || s === 'cancelled') return 'pill pill--red'
  if (s === 'draft' || s === 'completed') return 'pill pill--gray'
  return 'pill pill--violet'
}

function campaignMetricsSignature(r: CampaignRow): { spend: string; clicks: string; ctr: string } {
  return {
    spend: String(num(r.meta_insights_spend)),
    clicks: String(num(r.clicks)),
    ctr: ctrDisplay(r.impressions, r.clicks),
  }
}

function resultsRangeLabel(language: Language, meta: ListMeta | null, rowCount: number): string {
  if (!meta || meta.total === 0) return ''
  const start = rowCount === 0 ? 0 : (meta.current_page - 1) * meta.per_page + 1
  const end = rowCount === 0 ? 0 : start + rowCount - 1
  const template = t(language, 'campaignTracking.resultsMeta')
  return template.replace('{from}', String(start)).replace('{to}', String(end)).replace('{total}', String(meta.total))
}

export function CampaignTrackingPage() {
  const { language } = useAppContext()
  const [rows, setRows] = useState<CampaignRow[]>([])
  const [listMeta, setListMeta] = useState<ListMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [flashById, setFlashById] = useState<Map<number, Set<MetricKey>>>(() => new Map())
  const prevSig = useRef<Map<number, { spend: string; clicks: string; ctr: string }>>(new Map())
  const lastFilterRef = useRef<{ search: string; status: string } | null>(null)

  useEffect(() => {
    const tmr = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 320)
    return () => window.clearTimeout(tmr)
  }, [searchInput])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      try {
        const prevF = lastFilterRef.current
        const filterChanged =
          prevF === null || prevF.search !== debouncedSearch || prevF.status !== statusFilter
        if (filterChanged) {
          prevSig.current.clear()
          if (page !== 1) setPage(1)
        }
        const requestPage = filterChanged ? 1 : page

        const params: Record<string, string | number> = {
          per_page: PER_PAGE,
          page: requestPage,
        }
        if (debouncedSearch) params.search = debouncedSearch
        if (statusFilter) params.status = statusFilter

        const res = await api.get('/employee/campaigns', { params })
        const next = extractRows(res)
        setListMeta(extractMeta(res))
        lastFilterRef.current = { search: debouncedSearch, status: statusFilter }

        const flashes = new Map<number, Set<MetricKey>>()
        for (const r of next) {
          const id = num(r.id)
          if (!id) continue
          const cur = campaignMetricsSignature(r)
          const old = prevSig.current.get(id)
          if (old) {
            const s = new Set<MetricKey>()
            if (old.spend !== cur.spend) s.add('spend')
            if (old.clicks !== cur.clicks) s.add('clicks')
            if (old.ctr !== cur.ctr) s.add('ctr')
            if (s.size) flashes.set(id, s)
          }
          prevSig.current.set(id, cur)
        }

        setRows(next)
        if (flashes.size > 0) {
          setFlashById(flashes)
          window.setTimeout(() => setFlashById(new Map()), 700)
        }
      } catch {
        setRows([])
        setListMeta(null)
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [debouncedSearch, statusFilter, page]
  )

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load({ silent: true }), 30_000)
    return () => window.clearInterval(id)
  }, [load])

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const canGoPrev = (listMeta?.current_page ?? 1) > 1
  const canGoNext = (listMeta?.current_page ?? 1) < (listMeta?.last_page ?? 1)

  return (
    <section className="page-grid">
      <div className="page-title page-title--row">
        <div>
          <h2>{t(language, 'campaignTracking.title')}</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            {t(language, 'campaignTracking.subtitle')}
          </p>
        </div>
        <button type="button" className="ghost-btn" onClick={() => void load()}>
          {t(language, 'campaignTracking.refresh')}
        </button>
      </div>

      <HelpHint
        language={language}
        titleKey="campaignTracking.helpTitle"
        whatKey="campaignTracking.helpWhat"
        whyKey="campaignTracking.helpWhy"
        howKey="campaignTracking.helpHow"
      />

      <SectionCard title={t(language, 'campaignTracking.listTitle')}>
        <div className="tracking-toolbar">
          <div className="tracking-search-wrap">
            <Search className="tracking-search-icon" size={18} aria-hidden />
            <input
              type="search"
              className="tracking-search-input"
              placeholder={t(language, 'campaignTracking.searchPlaceholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
            {searchInput ? (
              <button
                type="button"
                className="tracking-search-clear ghost-btn"
                onClick={() => setSearchInput('')}
                aria-label={t(language, 'campaignTracking.clearSearch')}
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
          <div className="tracking-chips" role="group" aria-label={t(language, 'campaignTracking.filterStatus')}>
            {STATUS_FILTERS.map((val) => {
              const selected = statusFilter === val
              const label =
                val === '' ? t(language, 'campaignTracking.filterAll') : statusLabel(language, val)
              return (
                <button
                  key={val || 'all'}
                  type="button"
                  className={`tracking-chip ${selected ? 'tracking-chip--active' : ''}`}
                  onClick={() => {
                    if (val === statusFilter) return
                    setStatusFilter(val)
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {listMeta && listMeta.total > 0 ? (
          <p className="tracking-results-meta type-caption muted">{resultsRangeLabel(language, listMeta, rows.length)}</p>
        ) : null}

        {loading ? (
          <div className="tracking-skeleton-grid" aria-busy>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="tracking-card tracking-card--skeleton">
                <SkeletonLine />
                <div className="tracking-card__metrics tracking-card__metrics--skeleton">
                  <SkeletonLine />
                  <SkeletonLine />
                  <SkeletonLine />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="muted">
            {debouncedSearch || statusFilter
              ? t(language, 'campaignTracking.emptyFiltered')
              : t(language, 'campaignTracking.empty')}
          </p>
        ) : (
          <>
            <div className="tracking-grid">
              {rows.map((r, i) => {
                const id = num(r.id) || i
                const flashes = flashById.get(id) ?? new Set<MetricKey>()
                const spend = num(r.meta_insights_spend)
                const clicks = num(r.clicks)
                const impressions = num(r.impressions)
                const ctr = ctrDisplay(r.impressions, r.clicks)
                const isOpen = expanded.has(id)
                const staggerMs = Math.min(i, 12) * 42
                const st = String(r.status ?? '')

                return (
                  <article
                    key={String(r.id ?? i)}
                    className="tracking-card"
                    style={{ animationDelay: `${staggerMs}ms` }}
                  >
                    <header className="tracking-card__head">
                      <div className="tracking-card__title-block">
                        <h3 className="tracking-card__name" title={String(r.name ?? '')}>
                          {String(r.name ?? '—')}
                        </h3>
                        {r.customer_name ? (
                          <p className="tracking-card__customer type-caption muted">{String(r.customer_name)}</p>
                        ) : null}
                      </div>
                      <span className={statusPillClass(st)}>{statusLabel(language, st)}</span>
                    </header>

                    <div className="tracking-card__metrics">
                      <div
                        className={`tracking-card__metric ${flashes.has('spend') ? 'tracking-card__metric--flash' : ''}`}
                      >
                        <span className="tracking-card__metric-label">{t(language, 'campaignTracking.keySpend')}</span>
                        <span className="tracking-card__metric-value tracking-card__metric-value--spend">
                          {formatAdSpend(spend)}
                        </span>
                      </div>
                      <div
                        className={`tracking-card__metric ${flashes.has('clicks') ? 'tracking-card__metric--flash' : ''}`}
                      >
                        <span className="tracking-card__metric-label">{t(language, 'campaignTracking.keyClicks')}</span>
                        <span className="tracking-card__metric-value" title={formatGroupedInt(clicks)}>
                          {formatCompactCount(clicks)}
                        </span>
                      </div>
                      <div
                        className={`tracking-card__metric ${flashes.has('ctr') ? 'tracking-card__metric--flash' : ''}`}
                      >
                        <span className="tracking-card__metric-label">{t(language, 'campaignTracking.keyCtr')}</span>
                        <span className="tracking-card__metric-value">{ctr}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`tracking-card__more-btn ${isOpen ? 'tracking-card__more-btn--open' : ''}`}
                      onClick={() => toggleExpand(id)}
                      aria-expanded={isOpen}
                    >
                      <ChevronDown size={18} aria-hidden />
                      {t(language, 'campaignTracking.moreDetails')}
                    </button>

                    <div className={`tracking-card__details ${isOpen ? 'tracking-card__details--open' : ''}`}>
                      <dl className="tracking-card__dl">
                        <div className="tracking-card__dl-row">
                          <dt>{t(language, 'campaignTracking.detailBudget')}</dt>
                          <dd>{formatAdSpend(num(r.budget))}</dd>
                        </div>
                        <div className="tracking-card__dl-row">
                          <dt>{t(language, 'campaignTracking.detailImpressions')}</dt>
                          <dd title={formatGroupedInt(impressions)}>{formatGroupedInt(impressions)}</dd>
                        </div>
                        <div className="tracking-card__dl-row">
                          <dt>{t(language, 'campaignTracking.detailReach')}</dt>
                          <dd>{formatGroupedInt(num(r.reach))}</dd>
                        </div>
                        <div className="tracking-card__dl-row">
                          <dt>{t(language, 'campaignTracking.detailConversions')}</dt>
                          <dd>{formatGroupedInt(num(r.conversions))}</dd>
                        </div>
                        <div className="tracking-card__dl-row">
                          <dt>{t(language, 'campaignTracking.detailLastSync')}</dt>
                          <dd className="muted">
                            {r.last_synced_at ? String(r.last_synced_at).replace('T', ' ').slice(0, 19) : '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                )
              })}
            </div>

            {listMeta && listMeta.last_page > 1 ? (
              <div className="tracking-pagination">
                <button type="button" className="ghost-btn" disabled={!canGoPrev} onClick={() => setPage((p) => p - 1)}>
                  {t(language, 'campaignTracking.pagePrev')}
                </button>
                <span className="type-caption muted">
                  {listMeta.current_page} / {listMeta.last_page}
                </span>
                <button type="button" className="ghost-btn" disabled={!canGoNext} onClick={() => setPage((p) => p + 1)}>
                  {t(language, 'campaignTracking.pageNext')}
                </button>
              </div>
            ) : null}
          </>
        )}
      </SectionCard>
    </section>
  )
}
