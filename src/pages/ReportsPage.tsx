import { jsPDF } from 'jspdf'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SectionCard } from '../components/SectionCard'
import { TableSkeletonRows } from '../components/Skeleton'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { downloadReportCsv, fetchJsonAuthed, fetchReportJson } from '../lib/reportExport'
import { roleLabel, statusLabel, t } from '../i18n'
import type { Language, Role } from '../types'
import { currency } from '../utils/format'
import { relativeFromIso } from '../utils/time'
import { Bar, BarChart, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface WidgetPayload {
  user_pie?: { name: string; value: number; fill: string }[]
  balance_bars?: { name: string; value: number }[]
  role_distribution?: { role: string; label?: string; count: number }[]
  kpis?: {
    total_customer_balance: number
    pending_credit: number
    dormant_customers: number
    zero_balance_customers: number
    month_spend: number
  }
}

type DormantRow = { id: number; name: string; email: string; last_login_at?: string; balance: number }
type PersonRow = { id: number; name: string; email: string; roles?: string; balance?: number; last_login_at?: string }
type LogEntry = { at?: string; label?: string; amount?: number | null; status?: string; detail?: string | null }

function rowRoleLabel(language: Language, role: string): string {
  const roles: Role[] = ['super_admin', 'admin', 'employee', 'accountant', 'customer']
  return roles.includes(role as Role) ? roleLabel(language, role as Role) : role
}

export function ReportsPage() {
  const { language } = useAppContext()
  const [payload, setPayload] = useState<WidgetPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [datasetsLoading, setDatasetsLoading] = useState(true)
  const [reportKind, setReportKind] = useState('overview')
  const [range, setRange] = useState('30d')
  const [format, setFormat] = useState<'pdf' | 'csv' | 'json'>('pdf')
  const [exportBusy, setExportBusy] = useState(false)

  const [subTab, setSubTab] = useState<'overview' | 'financial' | 'operations' | 'activity'>('overview')

  const [dormant, setDormant] = useState<DormantRow[]>([])
  const [zeroBal, setZeroBal] = useState<DormantRow[]>([])
  const [employees, setEmployees] = useState<PersonRow[]>([])
  const [customers, setCustomers] = useState<PersonRow[]>([])
  const [campaignsByStatus, setCampaignsByStatus] = useState<{ name: string; value: number }[]>([])
  const [activityEmployees, setActivityEmployees] = useState<PersonRow[]>([])

  const [ledgerUserId, setLedgerUserId] = useState('')
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerEntries, setLedgerEntries] = useState<LogEntry[]>([])

  const loadCore = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.get('/reports/widgets')) as { data?: WidgetPayload }
      setPayload(res.data ?? null)
    } catch {
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDatasets = useCallback(async () => {
    setDatasetsLoading(true)
    try {
      const [d, z, e, c, camp, act] = await Promise.all([
        api.get('/reports/dormant-accounts') as Promise<{ data?: DormantRow[] }>,
        api.get('/reports/zero-balance') as Promise<{ data?: DormantRow[] }>,
        api.get('/reports/employees') as Promise<{ data?: PersonRow[] }>,
        api.get('/reports/customers') as Promise<{ data?: PersonRow[] }>,
        api.get('/reports/campaigns') as Promise<{ data?: { by_status?: Record<string, number>; total?: number } }>,
        api.get('/reports/employee-activity') as Promise<{ data?: PersonRow[] }>,
      ])
      setDormant(Array.isArray(d.data) ? d.data : [])
      setZeroBal(Array.isArray(z.data) ? z.data : [])
      setEmployees(Array.isArray(e.data) ? e.data : [])
      setCustomers(Array.isArray(c.data) ? c.data : [])
      setActivityEmployees(Array.isArray(act.data) ? act.data : [])
      const by = camp.data?.by_status && typeof camp.data.by_status === 'object' ? camp.data.by_status : {}
      setCampaignsByStatus(
        Object.entries(by).map(([name, value]) => ({
          name,
          value: Number(value),
        })),
      )
    } catch {
      setDormant([])
      setZeroBal([])
      setEmployees([])
      setCustomers([])
      setCampaignsByStatus([])
      setActivityEmployees([])
    } finally {
      setDatasetsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCore()
    void loadDatasets()
  }, [loadCore, loadDatasets])

  async function loadLedger() {
    const id = ledgerUserId.trim()
    if (!id) return
    setLedgerLoading(true)
    try {
      const res = (await api.get(`/reports/employees/${id}/logs`)) as { data?: { entries?: LogEntry[] } }
      setLedgerEntries(Array.isArray(res.data?.entries) ? res.data!.entries! : [])
    } catch {
      setLedgerEntries([])
    } finally {
      setLedgerLoading(false)
    }
  }

  const userPieRaw = useMemo(
    () =>
      payload?.user_pie?.length
        ? payload.user_pie
        : [
            { name: 'Customers', value: 0, fill: '#7c3aed' },
            { name: 'Team', value: 0, fill: '#c084fc' },
          ],
    [payload?.user_pie],
  )

  const userPie = useMemo(() => {
    const nameMap: Record<string, string> = {
      Customers: t(language, 'reports.pieCustomers'),
      Team: t(language, 'reports.pieTeam'),
    }
    return userPieRaw.map((p) => ({ ...p, name: nameMap[p.name] ?? p.name }))
  }, [userPieRaw, language])

  const balanceBarsRaw = useMemo(
    () =>
      payload?.balance_bars?.length
        ? payload.balance_bars
        : [
            { name: 'Customer balances', value: 0 },
            { name: 'Pending credits', value: 0 },
            { name: 'Spend (MTD)', value: 0 },
          ],
    [payload?.balance_bars],
  )

  const balanceBars = useMemo(() => {
    const nameMap: Record<string, string> = {
      'Customer balances': t(language, 'reports.barCustomerBalances'),
      'Pending credits': t(language, 'reports.barPendingCredits'),
      'Spend (MTD)': t(language, 'reports.barSpendMtd'),
    }
    return balanceBarsRaw.map((b) => ({ ...b, name: nameMap[b.name] ?? b.name }))
  }, [balanceBarsRaw, language])

  const campaignsChartData = useMemo(
    () =>
      campaignsByStatus.map((row) => ({
        ...row,
        label: statusLabel(language, row.name),
      })),
    [campaignsByStatus, language],
  )

  const k = payload?.kpis
  const rolesTable = payload?.role_distribution ?? []

  async function handleExport() {
    setExportBusy(true)
    try {
      if (format === 'csv') {
        await downloadReportCsv(reportKind, range)
        return
      }
      if (format === 'json') {
        const data = await fetchReportJson(reportKind, range)
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `yalla-report-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(a.href)
        return
      }

      const doc = new jsPDF()
      let y = 18
      doc.setFontSize(16)
      doc.setTextColor(88, 28, 135)
      doc.text('Yalla Media — Report', 14, y)
      y += 9
      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)
      doc.text(`Kind: ${reportKind}    Range: ${range}    Generated: ${new Date().toISOString().slice(0, 19)}`, 14, y)
      y += 10

      doc.setFontSize(11)
      doc.text('Summary KPIs', 14, y)
      y += 7
      doc.setFontSize(10)
      const kpis = k ?? {}
      const moneyKeys = ['total_customer_balance', 'pending_credit', 'month_spend']
      for (const [key, val] of Object.entries(kpis)) {
        const display = typeof val === 'number' && moneyKeys.includes(key) ? currency(val) : String(val)
        doc.text(`${key}: ${display}`, 14, y)
        y += 6
        if (y > 280) {
          doc.addPage()
          y = 16
        }
      }

      if (reportKind === 'dormant') {
        y += 4
        doc.setFontSize(11)
        doc.text('Dormant customers (14d+)', 14, y)
        y += 7
        doc.setFontSize(9)
        const raw = (await fetchJsonAuthed('reports/dormant-accounts')) as { data?: Record<string, unknown>[] }
        const rows = Array.isArray(raw.data) ? raw.data : []
        for (const row of rows.slice(0, 80)) {
          const line = `${row.id}  ${row.name}  ${row.email}  bal:${row.balance}`
          doc.text(line.substring(0, 95), 14, y)
          y += 5
          if (y > 285) {
            doc.addPage()
            y = 16
          }
        }
      }

      if (reportKind === 'zero') {
        y += 4
        doc.setFontSize(11)
        doc.text('Zero / empty wallet', 14, y)
        y += 7
        doc.setFontSize(9)
        const raw = (await fetchJsonAuthed('reports/zero-balance')) as { data?: Record<string, unknown>[] }
        const rows = Array.isArray(raw.data) ? raw.data : []
        for (const row of rows.slice(0, 80)) {
          const line = `${row.id}  ${row.name}  ${row.email}  ${row.balance}`
          doc.text(line.substring(0, 95), 14, y)
          y += 5
          if (y > 285) {
            doc.addPage()
            y = 16
          }
        }
      }

      doc.save(`yalla-report-${Date.now()}.pdf`)
    } catch {
      /* optional: toast */
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <section className="page-grid">
      <div className="page-title page-title--row">
        <div>
          <h2>{t(language, 'reports.title')}</h2>
          <p>{t(language, 'reports.subtitle')}</p>
          <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>
            {t(language, 'reports.audienceHint')}
          </p>
        </div>
      </div>

      <SectionCard
        title={t(language, 'reports.exportCardTitle')}
        description={t(language, 'reports.exportCardDesc')}
        action={
          <div className="row-actions" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <div className="filter-grid" style={{ marginBottom: 0, flex: '1 1 280px' }}>
              <select value={reportKind} onChange={(e) => setReportKind(e.target.value)} aria-label="Report">
                <option value="overview">{t(language, 'reports.fundingOverview')}</option>
                <option value="dormant">{t(language, 'reports.dormantAccountsReport')}</option>
                <option value="zero">{t(language, 'reports.zeroBalanceReport')}</option>
              </select>
              <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Range">
                <option value="7d">{t(language, 'reports.last7Days')}</option>
                <option value="30d">{t(language, 'reports.last30Days')}</option>
                <option value="90d">{t(language, 'reports.last90Days')}</option>
              </select>
              <select value={format} onChange={(e) => setFormat(e.target.value as 'pdf' | 'csv' | 'json')} aria-label="Format">
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <button type="button" className="primary-btn" disabled={exportBusy} onClick={() => void handleExport()}>
              {exportBusy ? '…' : t(language, 'common.exportReport')}
            </button>
          </div>
        }
      >
        <p className="muted" style={{ margin: 0 }}>
          {t(language, 'reports.exportCardFooter')}
        </p>
      </SectionCard>

      <div className="reports-subtabs" role="tablist">
        {(['overview', 'financial', 'operations', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className={subTab === tab ? 'active' : ''}
            onClick={() => setSubTab(tab)}
          >
            {tab === 'overview' && t(language, 'reports.tabOverview')}
            {tab === 'financial' && t(language, 'reports.tabFinancial')}
            {tab === 'operations' && t(language, 'reports.tabOperations')}
            {tab === 'activity' && t(language, 'reports.tabActivity')}
          </button>
        ))}
      </div>

      {!loading && k ? (
        <div className="section-card" style={{ marginBottom: 16, padding: '16px 18px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{t(language, 'reports.atAGlance')}</h3>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
            {t(language, 'reports.atAGlanceHint')}
          </p>
          <div className="report-kpis report-kpis--balanced">
            <div>
              <small>{t(language, 'reports.totalPlatformBalance')}</small>
              <strong>{currency(k.total_customer_balance ?? 0)}</strong>
            </div>
            <div>
              <small>{t(language, 'billing.pending')}</small>
              <strong>{currency(k.pending_credit ?? 0)}</strong>
            </div>
            <div>
              <small>{t(language, 'reports.dormantAccounts')}</small>
              <strong>{k.dormant_customers ?? 0}</strong>
            </div>
            <div>
              <small>{t(language, 'reports.zeroBalance')}</small>
              <strong>{k.zero_balance_customers ?? 0}</strong>
            </div>
            <div>
              <small>{t(language, 'reports.reservedFunds')}</small>
              <strong>{currency(k.month_spend ?? 0)}</strong>
            </div>
          </div>
        </div>
      ) : null}

      {subTab === 'overview' ? (
        <SectionCard title={t(language, 'reports.tabOverview')}>
          {loading ? (
            <TableSkeletonRows rows={3} cols={2} />
          ) : (
          <div className="reports-grid">
            <SectionCard title={t(language, 'reports.userDistribution')}>
              <div className="chart-wrap chart-wrap--tall">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={userPie} dataKey="value" nameKey="name" outerRadius={82} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} />
                    <Tooltip />
                    <Legend
                      verticalAlign="bottom"
                      formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title={t(language, 'reports.balanceDistribution')}>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={balanceBars}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
          )}
        </SectionCard>
      ) : null}

      {subTab === 'financial' ? (
        <SectionCard title={t(language, 'reports.financialTitle')} description={t(language, 'reports.financialDesc')}>
          {loading ? <TableSkeletonRows rows={4} cols={4} /> : null}
          <div className="chart-wrap" style={{ marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={balanceBars}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip formatter={(value) => currency(Number(value))} />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <h4>{t(language, 'reports.roleBreakdownTitle')}</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'users.role')}</th>
                  <th className="th-num">{t(language, 'reports.roleCount')}</th>
                </tr>
              </thead>
              <tbody>
                {rolesTable.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="muted">
                      {t(language, 'reports.noRows')}
                    </td>
                  </tr>
                ) : (
                  rolesTable.map((r) => (
                    <tr key={r.role}>
                      <td>{rowRoleLabel(language, r.role)}</td>
                      <td className="td-num">{r.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {subTab === 'operations' ? (
        <>
          <SectionCard title={t(language, 'reports.opsDormantTitle')} description={t(language, 'reports.opsDormantDesc')}>
            {datasetsLoading ? (
              <p className="muted">Loading…</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t(language, 'reports.tableId')}</th>
                      <th>{t(language, 'reports.tableName')}</th>
                      <th>{t(language, 'reports.tableEmail')}</th>
                      <th>{t(language, 'users.lastLogin')}</th>
                      <th>{t(language, 'users.balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dormant.slice(0, 100).map((r) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>{r.name}</td>
                        <td className="muted">{r.email}</td>
                        <td className="muted">{r.last_login_at ? relativeFromIso(language, r.last_login_at) : '—'}</td>
                        <td>{currency(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title={t(language, 'reports.opsZeroTitle')} description={t(language, 'reports.opsZeroDesc')}>
            {datasetsLoading ? (
              <p className="muted">Loading…</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t(language, 'reports.tableId')}</th>
                      <th>{t(language, 'reports.tableName')}</th>
                      <th>{t(language, 'reports.tableEmail')}</th>
                      <th>{t(language, 'users.balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zeroBal.slice(0, 100).map((r) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>{r.name}</td>
                        <td className="muted">{r.email}</td>
                        <td>{currency(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <div className="reports-grid">
            <SectionCard title={t(language, 'reports.teamDirectoryTitle')} description={t(language, 'reports.teamDirectoryDesc')}>
              {datasetsLoading ? (
                <p className="muted">Loading…</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t(language, 'reports.tableName')}</th>
                        <th>{t(language, 'users.role')}</th>
                        <th>{t(language, 'users.lastLogin')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.name}</strong>
                            <div className="muted">{r.email}</div>
                          </td>
                          <td>{r.roles ?? '—'}</td>
                          <td className="muted">{r.last_login_at ? relativeFromIso(language, r.last_login_at) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title={t(language, 'reports.customersTitle')} description={t(language, 'reports.customersDesc')}>
              {datasetsLoading ? (
                <p className="muted">Loading…</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t(language, 'reports.tableName')}</th>
                        <th>{t(language, 'users.balance')}</th>
                        <th>{t(language, 'users.lastLogin')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.name}</strong>
                            <div className="muted">{r.email}</div>
                          </td>
                          <td>{currency(Number(r.balance ?? 0))}</td>
                          <td className="muted">{r.last_login_at ? relativeFromIso(language, r.last_login_at) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard title={t(language, 'reports.campaignPipelineTitle')} description={t(language, 'reports.campaignPipelineDesc')}>
            {datasetsLoading ? (
              <p className="muted">Loading…</p>
            ) : campaignsChartData.length === 0 ? (
              <p className="muted">{t(language, 'reports.noRows')}</p>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={campaignsChartData}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-16} textAnchor="end" height={52} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value) => [String(value), t(language, 'reports.chartCountLabel')]} />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </>
      ) : null}

      {subTab === 'activity' ? (
        <>
          <SectionCard title={t(language, 'reports.activityRosterTitle')} description={t(language, 'reports.activityRosterDesc')}>
            {datasetsLoading ? (
              <p className="muted">Loading…</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t(language, 'reports.tableName')}</th>
                      <th>{t(language, 'reports.tableEmail')}</th>
                      <th>{t(language, 'users.lastLogin')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityEmployees.map((r) => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td className="muted">{r.email}</td>
                        <td className="muted">{r.last_login_at ? relativeFromIso(language, r.last_login_at) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={t(language, 'reports.ledgerTitle')}
            description={t(language, 'reports.ledgerDesc')}
            action={
              <div className="filter-grid">
                <input
                  placeholder={t(language, 'reports.ledgerPlaceholder')}
                  value={ledgerUserId}
                  onChange={(e) => setLedgerUserId(e.target.value)}
                  style={{ maxWidth: 120 }}
                  aria-label={t(language, 'reports.ledgerPlaceholder')}
                />
                <button type="button" className="primary-btn" disabled={ledgerLoading} onClick={() => void loadLedger()}>
                  {ledgerLoading ? '…' : t(language, 'reports.ledgerLoad')}
                </button>
              </div>
            }
          >
            {ledgerEntries.length === 0 ? (
              <p className="muted">{t(language, 'reports.ledgerEmpty')}</p>
            ) : (
              <div className="timeline">
                {ledgerEntries.map((e, i) => (
                  <div key={`${e.at}-${i}`} className="timeline-item">
                    <strong>{e.label}</strong>
                    <span className="pill pill--gray" style={{ marginLeft: 8 }}>
                      {e.status}
                    </span>
                    {e.amount != null ? <div>{currency(e.amount)}</div> : null}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {e.at ? relativeFromIso(language, e.at) : '—'}
                    </div>
                    {e.detail ? <p style={{ margin: '6px 0 0', fontSize: 13 }}>{e.detail}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      ) : null}
    </section>
  )
}
