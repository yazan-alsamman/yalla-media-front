import { FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { SectionCard } from '../components/SectionCard'
import { TableSkeletonRows } from '../components/Skeleton'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { statusLabel, t } from '../i18n'
import { currency } from '../utils/format'

interface Summary {
  paid: { amount: number; count: number }
  pending: { amount: number; count: number }
  failed: { amount: number; count: number }
}

export function BillsPage() {
  const { role, language, currentUser } = useAppContext()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [adminRows, setAdminRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        if (role === 'customer') {
          const s = (await api.get('/customer/bills/summary')) as { data?: Summary }
          if (!cancelled) setSummary(s.data ?? null)
          const inv = (await api.get('/customer/bills')) as { data?: Record<string, unknown>[] }
          if (!cancelled) setAdminRows(Array.isArray(inv.data) ? inv.data : [])
        } else if (role === 'super_admin' || role === 'admin') {
          const inv = (await api.get('/admin/invoices')) as { data?: Record<string, unknown>[] }
          if (!cancelled) {
            setSummary(null)
            setAdminRows(Array.isArray(inv.data) ? inv.data : [])
          }
        } else if (role === 'accountant' || (role === 'employee' && currentUser?.employee_type === 'accounting')) {
          const inv = (await api.get('/accountant/invoices')) as { data?: Record<string, unknown>[] }
          if (!cancelled) {
            setSummary(null)
            setAdminRows(Array.isArray(inv.data) ? inv.data : [])
          }
        } else {
          if (!cancelled) {
            setSummary(null)
            setAdminRows([])
          }
        }
      } catch {
        if (!cancelled) {
          setSummary(null)
          setAdminRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [role, currentUser?.employee_type])

  const canSeeBills =
    role === 'customer' ||
    role === 'super_admin' ||
    role === 'admin' ||
    role === 'accountant' ||
    (role === 'employee' && currentUser?.employee_type === 'accounting')

  if (!canSeeBills) {
    return (
      <section className="page-grid">
        <div className="page-title">
          <h2>{t(language, 'bills.title')}</h2>
          <p>{t(language, 'common.noPermission')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page-grid">
      <div className="page-title">
        <h2>{t(language, 'bills.title')}</h2>
        <p>{t(language, 'bills.subtitle')}</p>
      </div>

      {role === 'customer' && summary ? (
        <div className="mini-kpi-grid">
          <div className="mini-kpi">
            <small>{t(language, 'bills.paid')}</small>
            <strong>{currency(summary.paid.amount)}</strong>
            <span className="type-caption">
              {summary.paid.count} {t(language, 'bills.invoice')}
              {summary.paid.count === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mini-kpi">
            <small>{t(language, 'bills.paymentPending')}</small>
            <strong>{currency(summary.pending.amount)}</strong>
            <span className="type-caption">
              {summary.pending.count} {t(language, 'bills.invoice')}
              {summary.pending.count === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mini-kpi">
            <small>{t(language, 'bills.failed')}</small>
            <strong>{currency(summary.failed.amount)}</strong>
            <span className="type-caption">
              {summary.failed.count} {t(language, 'bills.invoice')}
              {summary.failed.count === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      ) : null}

      <SectionCard title={role === 'customer' ? t(language, 'bills.title') : t(language, 'bills.platformInvoices')}>
        {loading ? (
          <TableSkeletonRows rows={6} cols={role !== 'customer' ? 8 : 7} />
        ) : adminRows.length === 0 ? (
          <EmptyState icon={FileText} title={t(language, 'bills.noInvoices')} description={t(language, 'bills.emptyHint')} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'bills.number')}</th>
                  {role !== 'customer' ? <th>{language === 'ar' ? 'العميل' : 'Customer'}</th> : null}
                  <th>{language === 'ar' ? 'العنوان' : 'Title'}</th>
                  <th className="th-num">{t(language, 'bills.base')}</th>
                  <th className="th-num">{t(language, 'bills.commission')}</th>
                  <th className="th-num">{t(language, 'bills.total')}</th>
                  <th>{t(language, 'users.status')}</th>
                  <th>{t(language, 'bills.dateCol')}</th>
                </tr>
              </thead>
              <tbody>
                {adminRows.map((r) => (
                  <tr key={String(r.id)}>
                    <td>{String(r.invoice_number)}</td>
                    {role !== 'customer' ? <td>{String(r.customer_name ?? r.customer_email ?? '—')}</td> : null}
                    <td>{String(r.title ?? '—')}</td>
                    <td className="td-num">
                      {r.base_amount != null ? currency(Number(r.base_amount)) : currency(Number(r.amount))}
                    </td>
                    <td className="td-num">
                      {r.commission_amount != null ? currency(Number(r.commission_amount)) : '—'}
                    </td>
                    <td className="td-num">{currency(Number(r.amount))}</td>
                    <td>
                      <span
                        className={`pill ${
                          String(r.status) === 'paid'
                            ? 'pill--green'
                            : String(r.status) === 'failed'
                              ? 'pill--red'
                              : String(r.status) === 'pending'
                                ? 'pill--amber'
                                : 'pill--gray'
                        }`}
                      >
                        {statusLabel(language, String(r.status ?? ''))}
                      </span>
                    </td>
                    <td className="type-caption">{r.issued_at ? String(r.issued_at).slice(0, 10) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </section>
  )
}
