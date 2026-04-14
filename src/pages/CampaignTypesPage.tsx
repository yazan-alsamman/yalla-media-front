import { Pencil } from 'lucide-react'
import { TruncatedCopy } from '../components/TruncatedCopy'
import { SkeletonLine } from '../components/Skeleton'
import { useCallback, useEffect, useState } from 'react'
import { Modal } from '../components/Modal'
import { SectionCard } from '../components/SectionCard'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { statusLabel, t } from '../i18n'
import { formatDecimalForUi } from '../utils/format'

type Row = Record<string, unknown>

export function CampaignTypesPage() {
  const { role, language } = useAppContext()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [disp, setDisp] = useState('')
  const [rate, setRate] = useState('')
  const [desc, setDesc] = useState('')
  const [active, setActive] = useState(true)
  const [sortOrder, setSortOrder] = useState('0')

  const allowed = role === 'admin' || role === 'super_admin'

  const load = useCallback(async () => {
    if (!allowed) return
    setLoading(true)
    try {
      const res = (await api.get('/admin/campaign-types')) as { data?: Row[] }
      setRows(Array.isArray(res.data) ? res.data : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [allowed])

  useEffect(() => {
    if (!allowed) {
      setLoading(false)
      return
    }
    void load()
  }, [allowed, load])

  function openEdit(r: Row) {
    const id = Number(r.id)
    setEditId(id)
    setDisp(String(r.display_name ?? r.name ?? ''))
    setRate(String(r.rate_per_dollar ?? ''))
    setDesc(String(r.description ?? ''))
    setActive(Boolean(r.is_active ?? true))
    setSortOrder(String(r.sort_order ?? 0))
    setEditOpen(true)
  }

  async function saveEdit() {
    if (editId == null) return
    setBusyId(editId)
    try {
      await api.put(`/admin/campaign-types/${editId}`, {
        display_name: disp.trim() || undefined,
        rate_per_dollar: rate === '' ? undefined : Number(rate),
        description: desc.trim() || undefined,
        is_active: active,
        sort_order: sortOrder === '' ? undefined : Number(sortOrder),
      })
      setEditOpen(false)
      setEditId(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (!allowed) {
    return (
      <section className="page-grid">
        <div className="page-title">
          <h2>{t(language, 'campaignTypes.title')}</h2>
          <p>{t(language, 'common.noPermission')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page-grid">
      <div className="page-title">
        <h2>{t(language, 'campaignTypes.title')}</h2>
        <p>{t(language, 'campaignTypes.subtitle')}</p>
      </div>

      <SectionCard title={t(language, 'campaignTypes.catalogTitle')}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLine key={i} />
            ))}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'campaignTypes.idColumn')}</th>
                  <th>{t(language, 'campaignTypes.displayName')}</th>
                  <th>{t(language, 'campaignTypes.internalKey')}</th>
                  <th className="th-num">{t(language, 'campaignTypes.rate')}</th>
                  <th>{t(language, 'common.active')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td>
                      <TruncatedCopy value={String(r.id)} maxLen={8} />
                    </td>
                    <td>
                      <strong>{String(r.display_name ?? r.name)}</strong>
                    </td>
                    <td className="type-caption">{String(r.slug ?? '—')}</td>
                    <td className="td-num">
                      {r.rate_per_dollar != null && r.rate_per_dollar !== ''
                        ? formatDecimalForUi(Number(r.rate_per_dollar), {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })
                        : '—'}
                    </td>
                    <td>
                      <span className={`pill ${r.is_active ? 'pill--green' : 'pill--gray'}`}>
                        {r.is_active ? statusLabel(language, 'active') : statusLabel(language, 'inactive')}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        title={language === 'ar' ? 'تعديل' : 'Edit type'}
                        aria-label={language === 'ar' ? 'تعديل' : 'Edit type'}
                        disabled={busyId === Number(r.id)}
                        onClick={() => openEdit(r)}
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        title={`Edit type #${editId ?? ''}`}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setEditOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void saveEdit()}>
              {busyId != null ? '…' : language === 'ar' ? 'حفظ' : 'Save changes'}
            </button>
          </div>
        }
      >
        <div className="settings-grid">
          <label>
            <span>Display name</span>
            <input value={disp} onChange={(e) => setDisp(e.target.value)} />
          </label>
          <label>
            <span>Rate per dollar</span>
            <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
          <label>
            <span>Description</span>
            <textarea className="modal-textarea" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <label>
            <span>Sort order</span>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </label>
          <label className="field-inline">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>Active</span>
          </label>
        </div>
      </Modal>
    </section>
  )
}
