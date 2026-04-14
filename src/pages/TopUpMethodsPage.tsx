import { CheckCircle2, Pencil, Plus, Power } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../components/AppDialog'
import { Modal } from '../components/Modal'
import { SectionCard } from '../components/SectionCard'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { t } from '../i18n'

type MethodRow = {
  id: number
  code: string
  name: string
  description: string | null
  instructions: string | null
  transfer_hint: string | null
  requires_proof: boolean
  sort_order: number
  is_active: boolean
}

function extractList(res: unknown): MethodRow[] {
  if (!res || typeof res !== 'object') return []
  const r = res as { data?: unknown }
  if (Array.isArray(r.data)) return r.data as MethodRow[]
  const inner = r.data as { data?: unknown }
  if (inner && typeof inner === 'object' && Array.isArray(inner.data)) return inner.data as MethodRow[]
  return []
}

const emptyForm = {
  code: '',
  name: '',
  description: '',
  instructions: '',
  transfer_hint: '',
  requires_proof: true,
  sort_order: '0',
  is_active: true,
}

export function TopUpMethodsPage() {
  const { language } = useAppContext()
  const [rows, setRows] = useState<MethodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MethodRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MethodRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/accountant/top-up-methods')
      setRows(extractList(res))
    } catch {
      setRows([])
      setError(t(language, 'topUpMethods.loadError'))
    } finally {
      setLoading(false)
    }
  }, [language])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(row: MethodRow) {
    setEditing(row)
    setForm({
      code: row.code,
      name: row.name,
      description: row.description ?? '',
      instructions: row.instructions ?? '',
      transfer_hint: row.transfer_hint ?? '',
      requires_proof: row.requires_proof,
      sort_order: String(row.sort_order ?? 0),
      is_active: row.is_active,
    })
    setError(null)
    setModalOpen(true)
  }

  async function submitModal() {
    setSaving(true)
    setError(null)
    const payload = {
      code: form.code.trim().toLowerCase().replace(/\s+/g, '_'),
      name: form.name.trim(),
      description: form.description.trim() || null,
      instructions: form.instructions.trim() || null,
      transfer_hint: form.transfer_hint.trim() || null,
      requires_proof: form.requires_proof,
      sort_order: Number.parseInt(form.sort_order, 10) || 0,
      is_active: form.is_active,
    }
    if (!payload.code || !payload.name) {
      setError(t(language, 'topUpMethods.validationCodeName'))
      setSaving(false)
      return
    }
    try {
      if (editing) {
        await api.put(`/accountant/top-up-methods/${editing.id}`, payload)
      } else {
        await api.post('/accountant/top-up-methods', payload)
      }
      setModalOpen(false)
      await load()
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : ''
      setError(msg || t(language, 'topUpMethods.saveError'))
    } finally {
      setSaving(false)
    }
  }

  function requestRemoveRow(row: MethodRow) {
    setPendingDelete(row)
  }

  async function confirmRemoveRow() {
    const row = pendingDelete
    if (!row) return
    setPendingDelete(null)
    try {
      await api.delete(`/accountant/top-up-methods/${row.id}`)
      await load()
    } catch {
      setError(t(language, 'topUpMethods.deleteError'))
    }
  }

  async function enableRow(row: MethodRow) {
    try {
      await api.put(`/accountant/top-up-methods/${row.id}`, { is_active: true })
      await load()
    } catch {
      setError(t(language, 'topUpMethods.saveError'))
    }
  }

  return (
    <section className="page-grid">
      <div className="page-title page-title--row">
        <div>
          <h2>{t(language, 'topUpMethods.title')}</h2>
          <p className="muted">{t(language, 'topUpMethods.subtitle')}</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => openCreate()}>
          <Plus size={16} aria-hidden /> {t(language, 'topUpMethods.add')}
        </button>
      </div>

      {error && !modalOpen ? <p className="login-error">{error}</p> : null}

      <SectionCard title={t(language, 'topUpMethods.tableTitle')} description={t(language, 'topUpMethods.tableHint')}>
        {loading ? (
          <p className="muted">{t(language, 'common.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="muted">{t(language, 'topUpMethods.empty')}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t(language, 'topUpMethods.colOrder')}</th>
                  <th>{t(language, 'topUpMethods.colCode')}</th>
                  <th>{t(language, 'topUpMethods.colName')}</th>
                  <th>{t(language, 'topUpMethods.colReceipt')}</th>
                  <th>{t(language, 'topUpMethods.colActive')}</th>
                  <th>{t(language, 'campaigns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={!r.is_active ? 'row-muted' : undefined}>
                    <td>{r.sort_order}</td>
                    <td>
                      <code>{r.code}</code>
                    </td>
                    <td>{r.name}</td>
                    <td>
                      <span className={r.requires_proof ? 'pill pill--amber' : 'pill pill--gray'}>
                        {r.requires_proof ? t(language, 'topUpMethods.receiptRequired') : t(language, 'topUpMethods.receiptOptional')}
                      </span>
                    </td>
                    <td>
                      <span className={r.is_active ? 'pill pill--green' : 'pill pill--gray'}>
                        {r.is_active ? t(language, 'common.active') : t(language, 'topUpMethods.inactive')}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title={t(language, 'topUpMethods.edit')}
                          aria-label={t(language, 'topUpMethods.edit')}
                          onClick={() => openEdit(r)}
                        >
                          <Pencil size={16} />
                        </button>
                        {r.is_active ? (
                          <button
                            type="button"
                            className="icon-btn"
                            title={t(language, 'topUpMethods.delete')}
                            aria-label={t(language, 'topUpMethods.delete')}
                            onClick={() => requestRemoveRow(r)}
                          >
                            <Power size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="icon-btn"
                            title={t(language, 'topUpMethods.enable')}
                            aria-label={t(language, 'topUpMethods.enable')}
                            onClick={() => void enableRow(r)}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t(language, 'topUpMethods.editTitle') : t(language, 'topUpMethods.createTitle')}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="ghost-btn" onClick={() => setModalOpen(false)}>
              {t(language, 'tasks.btnCancel')}
            </button>
            <button type="button" className="primary-btn" disabled={saving} onClick={() => void submitModal()}>
              {saving ? '…' : t(language, 'topUpMethods.save')}
            </button>
          </div>
        }
      >
        <div className="modal-form-grid">
          {error ? <p className="login-error">{error}</p> : null}
          <label className="modal-field">
            <span>{t(language, 'topUpMethods.fieldCode')}</span>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              disabled={!!editing}
              placeholder="syriatel_cash"
              dir="ltr"
            />
          </label>
          <label className="modal-field">
            <span>{t(language, 'topUpMethods.fieldName')}</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t(language, 'topUpMethods.fieldNamePh')}
            />
          </label>
          <label className="modal-field">
            <span>{t(language, 'topUpMethods.fieldDescription')}</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="modal-field">
            <span>{t(language, 'topUpMethods.fieldInstructions')}</span>
            <textarea
              rows={3}
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              placeholder={t(language, 'topUpMethods.fieldInstructionsPh')}
            />
          </label>
          <label className="modal-field">
            <span>{t(language, 'topUpMethods.fieldTransferHint')}</span>
            <input
              value={form.transfer_hint}
              onChange={(e) => setForm((f) => ({ ...f, transfer_hint: e.target.value }))}
              placeholder={t(language, 'topUpMethods.fieldTransferHintPh')}
              dir="ltr"
            />
          </label>
          <label className="modal-field">
            <span>{t(language, 'topUpMethods.fieldSort')}</span>
            <input
              type="number"
              min={0}
              value={form.sort_order}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            />
          </label>
          <label className="modal-field modal-field--checkbox">
            <input
              type="checkbox"
              checked={form.requires_proof}
              onChange={(e) => setForm((f) => ({ ...f, requires_proof: e.target.checked }))}
            />
            <span>{t(language, 'topUpMethods.checkboxReceipt')}</span>
          </label>
          <p className="type-caption muted" style={{ margin: 0 }}>
            {t(language, 'topUpMethods.checkboxReceiptHelp')}
          </p>
          <label className="modal-field modal-field--checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            <span>{t(language, 'topUpMethods.checkboxActive')}</span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDelete != null}
        title={t(language, 'topUpMethods.delete')}
        message={t(language, 'topUpMethods.deleteConfirm')}
        confirmLabel={t(language, 'topUpMethods.delete')}
        cancelLabel={t(language, 'users.cancel')}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmRemoveRow()}
      />
    </section>
  )
}
