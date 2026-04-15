import { Ban, CheckCircle, ClipboardList, Eye, Play, Plus, ShieldAlert, UserRoundCog } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { SkeletonLine } from '../components/Skeleton'
import { TaskDetailView } from '../components/StructuredEntityDetails'
import { ConfirmDialog } from '../components/AppDialog'
import { Modal } from '../components/Modal'
import { SectionCard } from '../components/SectionCard'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { canEmployeeEscalateTasks, taskTypesForStaff } from '../lib/staffConfig'
import { priorityLabel, statusLabel, taskStatLabel, taskTypeLabel, t } from '../i18n'

type Row = Record<string, unknown>

function extractTaskRows(res: unknown): Row[] {
  if (!res || typeof res !== 'object') return []
  const r = res as { data?: unknown }
  if (Array.isArray(r.data)) return r.data as Row[]
  const inner = r.data as { data?: unknown }
  if (inner && typeof inner === 'object' && Array.isArray(inner.data)) return inner.data as Row[]
  return []
}

function taskStatusPillClass(st: string): string {
  if (st === 'completed') return 'pill--green'
  if (st === 'cancelled') return 'pill--gray'
  if (st === 'in_progress') return 'pill--violet'
  if (st === 'pending') return 'pill--amber'
  return 'pill--gray'
}

export function TasksPage() {
  const { role, language, currentUser, refreshInbox } = useAppContext()
  const [rows, setRows] = useState<Row[]>([])
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [pendingCancelId, setPendingCancelId] = useState<number | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null)

  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeId, setCompleteId] = useState<number | null>(null)
  const [completeNotes, setCompleteNotes] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [ctitle, setCtitle] = useState('')
  const [ctype, setCtype] = useState('campaign_linking')
  const [cpriority, setCpriority] = useState('medium')
  const [cassign, setCassign] = useState('')
  const [ccampaign, setCcampaign] = useState('')
  const [cadAccountId, setCadAccountId] = useState('')
  const [userOptions, setUserOptions] = useState<{ id: number; label: string }[]>([])

  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignId, setReassignId] = useState<number | null>(null)
  const [reassignUser, setReassignUser] = useState('')

  const [escalateOpen, setEscalateOpen] = useState(false)
  const [escalateId, setEscalateId] = useState<number | null>(null)
  const [escalateNote, setEscalateNote] = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [taskTypeFilter, setTaskTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')

  const isAdmin = role === 'admin' || role === 'super_admin'
  const canCreateTasks = role === 'super_admin'
  const isSuperAdmin = role === 'super_admin'
  const allowed = role === 'employee' || role === 'accountant' || isAdmin
  const typeFilter = taskTypesForStaff(role, currentUser?.employee_type)
  const canEscalate =
    (role === 'employee' && canEmployeeEscalateTasks(currentUser?.employee_type)) || role === 'accountant'
  const myId = currentUser?.id

  const visibleRows = useMemo(() => {
    if (!typeFilter) return rows
    return rows.filter((r) => typeFilter.includes(String(r.type ?? '')))
  }, [rows, typeFilter])

  const filteredRows = useMemo(() => {
    const q = taskSearch.trim().toLowerCase()
    return visibleRows.filter((r) => {
      const status = String(r.status ?? '')
      const type = String(r.type ?? '')
      const priority = String(r.priority ?? '')
      const assignee = String(r.assignee_name ?? '')
      if (statusFilter !== 'all' && status !== statusFilter) return false
      if (taskTypeFilter !== 'all' && type !== taskTypeFilter) return false
      if (priorityFilter !== 'all' && priority !== priorityFilter) return false
      if (assigneeFilter !== 'all' && assignee !== assigneeFilter) return false
      if (!q) return true
      const title = String(r.title ?? '').toLowerCase()
      const desc = String(r.description ?? '').toLowerCase()
      const creator = String(r.creator_name ?? '').toLowerCase()
      const assigneeLower = assignee.toLowerCase()
      return title.includes(q) || desc.includes(q) || assigneeLower.includes(q) || creator.includes(q)
    })
  }, [assigneeFilter, priorityFilter, statusFilter, taskSearch, taskTypeFilter, visibleRows])

  const assigneeOptions = useMemo(() => {
    return Array.from(new Set(visibleRows.map((r) => String(r.assignee_name ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [visibleRows])

  const taskTypeOptions = useMemo(() => {
    return Array.from(new Set(visibleRows.map((r) => String(r.type ?? '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [visibleRows])

  function priorityPillClass(p: string): string {
    if (p === 'urgent') return 'priority-pill priority-pill--urgent'
    if (p === 'high') return 'priority-pill priority-pill--high'
    if (p === 'medium') return 'priority-pill priority-pill--medium'
    return 'priority-pill priority-pill--low'
  }

  const load = useCallback(async () => {
    if (!allowed) return
    setLoading(true)
    try {
      const st = (await api.get('/tasks/stats')) as { data?: Record<string, number> }
      setStats(st.data ?? null)

      const list = await api.get('/tasks', { params: { per_page: 50 } })
      setRows(extractTaskRows(list))
    } catch {
      setRows([])
      setStats(null)
    } finally {
      setLoading(false)
      void refreshInbox()
    }
  }, [allowed, refreshInbox])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (role !== 'super_admin') return
    void (async () => {
      try {
        const users = (await api.get('/admin/users', { params: { segment: 'team', per_page: 100 } })) as {
          data?: { id: number; name: string; email: string; role?: string }[]
        }
        const list = users.data ?? []
        setUserOptions(
          list
            .filter((u) => u.role !== 'customer')
            .map((u) => ({ id: u.id, label: u.name })),
        )
      } catch {
        setUserOptions([])
      }
    })()
  }, [role])

  async function openDetail(id: number) {
    setBusyId(id)
    setDetailOpen(true)
    setDetailData(null)
    try {
      const res = (await api.get(`/tasks/${id}`)) as { data?: Record<string, unknown> }
      setDetailData((res.data && typeof res.data === 'object' ? res.data : {}) as Record<string, unknown>)
    } catch {
      setDetailData({})
    } finally {
      setBusyId(null)
    }
  }

  async function startTask(id: number) {
    setBusyId(id)
    try {
      await api.put(`/tasks/${id}/start`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  function openComplete(id: number) {
    setCompleteId(id)
    setCompleteNotes('')
    setCompleteOpen(true)
  }

  async function submitComplete() {
    if (completeId == null) return
    setBusyId(completeId)
    try {
      await api.put(`/tasks/${completeId}/complete`, { notes: completeNotes.trim() || undefined })
      setCompleteOpen(false)
      setCompleteId(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function submitCreate() {
    if (!ctitle.trim()) return
    if (ctype === 'ad_account_linking' && !cadAccountId.trim()) return
    setBusyId(-1)
    try {
      await api.post('/tasks', {
        title: ctitle.trim(),
        type: ctype,
        priority: cpriority,
        assigned_to: cassign ? Number(cassign) : undefined,
        campaign_id: ccampaign ? Number(ccampaign) : undefined,
        ad_account_id: cadAccountId ? Number(cadAccountId) : undefined,
      })
      setCreateOpen(false)
      setCtitle('')
      setCassign('')
      setCcampaign('')
      setCadAccountId('')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  function openReassign(id: number) {
    setReassignId(id)
    setReassignUser('')
    setReassignOpen(true)
  }

  async function submitReassign() {
    if (reassignId == null || !reassignUser) return
    setBusyId(reassignId)
    try {
      await api.put(`/tasks/${reassignId}/reassign`, { assigned_to: Number(reassignUser) })
      setReassignOpen(false)
      setReassignId(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  function requestCancelTask(id: number) {
    setPendingCancelId(id)
  }

  async function confirmCancelTask() {
    const id = pendingCancelId
    if (id == null) return
    setPendingCancelId(null)
    setBusyId(id)
    try {
      await api.put(`/tasks/${id}/cancel`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  function openEscalate(id: number) {
    setEscalateId(id)
    setEscalateNote('')
    setEscalateOpen(true)
  }

  async function submitEscalate() {
    if (escalateId == null) return
    setBusyId(escalateId)
    try {
      await api.post(`/tasks/${escalateId}/escalate`, { note: escalateNote.trim() || undefined })
      setEscalateOpen(false)
      setEscalateId(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (!allowed) {
    return (
      <section className="page-grid">
        <div className="page-title">
          <h2>{t(language, 'tasks.title')}</h2>
          <p>{t(language, 'common.noPermission')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page-grid">
      <div className="page-title page-title--row page-title--warm">
        <div>
          <h2>
            <span className="page-title__emoji" aria-hidden>
              ✦
            </span>
            {t(language, 'tasks.title')}
          </h2>
          <p>{t(language, 'tasks.subtitle')}</p>
        </div>
        {canCreateTasks ? (
          <button type="button" className="primary-btn" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> {t(language, 'tasks.newTask')}
          </button>
        ) : null}
      </div>

      {stats ? (
        <div className="mini-kpi-grid">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="mini-kpi">
              <small>{taskStatLabel(language, k)}</small>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <SectionCard title={t(language, 'tasks.listTitle')}>
        <input
          type="search"
          className="list-search"
          placeholder={t(language, 'tasks.searchPlaceholder')}
          value={taskSearch}
          onChange={(e) => setTaskSearch(e.target.value)}
          aria-label={t(language, 'tasks.searchPlaceholder')}
        />
        <div className="row-actions" style={{ flexWrap: 'wrap', marginTop: 10 }}>
          <label>
            <span className="type-caption">{t(language, 'tasks.filterStatus')}</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t(language, 'tasks.filterAll')}</option>
              <option value="pending">{taskStatLabel(language, 'pending')}</option>
              <option value="in_progress">{taskStatLabel(language, 'in_progress')}</option>
              <option value="completed">{taskStatLabel(language, 'completed')}</option>
              <option value="cancelled">{taskStatLabel(language, 'cancelled')}</option>
            </select>
          </label>
          <label>
            <span className="type-caption">{t(language, 'tasks.filterType')}</span>
            <select value={taskTypeFilter} onChange={(e) => setTaskTypeFilter(e.target.value)}>
              <option value="all">{t(language, 'tasks.filterAll')}</option>
              {taskTypeOptions.map((tt) => (
                <option key={tt} value={tt}>
                  {taskTypeLabel(language, tt)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="type-caption">{t(language, 'tasks.filterPriority')}</span>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">{t(language, 'tasks.filterAll')}</option>
              <option value="low">{priorityLabel(language, 'low')}</option>
              <option value="medium">{priorityLabel(language, 'medium')}</option>
              <option value="high">{priorityLabel(language, 'high')}</option>
              <option value="urgent">{priorityLabel(language, 'urgent')}</option>
            </select>
          </label>
          <label>
            <span className="type-caption">{t(language, 'tasks.filterAssignee')}</span>
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="all">{t(language, 'tasks.filterAll')}</option>
              {assigneeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setTaskSearch('')
              setStatusFilter('all')
              setTaskTypeFilter('all')
              setPriorityFilter('all')
              setAssigneeFilter('all')
            }}
          >
            {t(language, 'tasks.clearFilters')}
          </button>
        </div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLine key={i} />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={t(language, 'tasks.none')}
            description={t(language, 'tasks.emptyHint')}
            action={
              canCreateTasks ? (
                <button type="button" className="primary-btn" onClick={() => setCreateOpen(true)}>
                  <Plus size={16} /> {t(language, 'tasks.newTask')}
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'tasks.taskColTitle')}</th>
                  <th>{t(language, 'tasks.type')}</th>
                  <th>{t(language, 'users.status')}</th>
                  <th>{t(language, 'tasks.priority')}</th>
                  <th>{t(language, 'tasks.assignee')}</th>
                  <th>{t(language, 'campaigns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const id = Number(r.id)
                  const st = String(r.status ?? '')
                  const superHot = Boolean(r.created_by_super_admin)
                  return (
                    <tr key={id} className={superHot ? 'task-row--super-hot' : undefined}>
                      <td>
                        {superHot ? (
                          <div className="tasks-table__hot" title={t(language, 'tasks.superAdminTask')}>
                            🔥 <span>{t(language, 'tasks.superAdminTaskShort')}</span>
                          </div>
                        ) : null}
                        <strong className="tasks-table__title-only">{String(r.title)}</strong>
                      </td>
                      <td>{taskTypeLabel(language, String(r.type))}</td>
                      <td>
                        <span className={`pill ${taskStatusPillClass(st)}`}>{statusLabel(language, st)}</span>
                      </td>
                      <td>
                        {isSuperAdmin && (st === 'pending' || st === 'in_progress') ? (
                          <select
                            className="list-search"
                            aria-label={t(language, 'tasks.priority')}
                            style={{ maxWidth: 148, padding: '6px 8px', fontSize: 13 }}
                            value={String(r.priority ?? 'medium')}
                            disabled={busyId === id}
                            onChange={async (e) => {
                              const next = e.target.value
                              if (next === String(r.priority ?? '')) return
                              setBusyId(id)
                              try {
                                await api.put(`/tasks/${id}/priority`, { priority: next })
                                await load()
                              } finally {
                                setBusyId(null)
                              }
                            }}
                          >
                            <option value="low">{priorityLabel(language, 'low')}</option>
                            <option value="medium">{priorityLabel(language, 'medium')}</option>
                            <option value="high">{priorityLabel(language, 'high')}</option>
                            <option value="urgent">{priorityLabel(language, 'urgent')}</option>
                          </select>
                        ) : (
                          <span className={priorityPillClass(String(r.priority ?? ''))}>
                            {String(r.priority) === 'high' || String(r.priority) === 'urgent' ? '🔥 ' : null}
                            {priorityLabel(language, String(r.priority ?? ''))}
                          </span>
                        )}
                      </td>
                      <td>{String(r.assignee_name ?? '—')}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title={language === 'ar' ? 'عرض التفاصيل' : 'View details'}
                            aria-label={language === 'ar' ? 'عرض التفاصيل' : 'View details'}
                            disabled={busyId === id}
                            onClick={() => void openDetail(id)}
                          >
                            <Eye size={15} />
                          </button>
                          {st === 'pending' ? (
                            <button
                              type="button"
                              className="icon-btn"
                              title={language === 'ar' ? 'بدء المهمة' : 'Start task'}
                              aria-label={language === 'ar' ? 'بدء المهمة' : 'Start task'}
                              disabled={busyId === id}
                              onClick={() => void startTask(id)}
                            >
                              <Play size={14} />
                            </button>
                          ) : null}
                          {st === 'pending' || st === 'in_progress' ? (
                            <button
                              type="button"
                              className="icon-btn"
                              title={language === 'ar' ? 'إكمال' : 'Mark complete'}
                              aria-label={language === 'ar' ? 'إكمال' : 'Mark complete'}
                              disabled={busyId === id}
                              onClick={() => openComplete(id)}
                            >
                              <CheckCircle size={14} />
                            </button>
                          ) : null}
                          {canEscalate && myId != null && Number(r.assigned_to) === myId && (st === 'pending' || st === 'in_progress') ? (
                            <button
                              type="button"
                              className="icon-btn"
                              title={t(language, 'tasks.escalate')}
                              aria-label={t(language, 'tasks.escalate')}
                              disabled={busyId === id}
                              onClick={() => openEscalate(id)}
                            >
                              <ShieldAlert size={14} />
                            </button>
                          ) : null}
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                title={language === 'ar' ? 'إعادة التكليف' : 'Reassign'}
                                aria-label={language === 'ar' ? 'إعادة التكليف' : 'Reassign'}
                                disabled={busyId === id}
                                onClick={() => openReassign(id)}
                              >
                                <UserRoundCog size={14} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                title={language === 'ar' ? 'إلغاء المهمة' : 'Cancel task'}
                                aria-label={language === 'ar' ? 'إلغاء المهمة' : 'Cancel task'}
                                disabled={busyId === id}
                                onClick={() => requestCancelTask(id)}
                              >
                                <Ban size={14} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal title={t(language, 'tasks.modalDetailTitle')} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {detailData ? (
          <div className="task-detail-modal-root">
            <TaskDetailView data={detailData} onMutate={() => void load()} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonLine key={i} />
            ))}
          </div>
        )}
      </Modal>

      <Modal
        title={t(language, 'tasks.modalCompleteTitle')}
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setCompleteOpen(false)}>
              {t(language, 'tasks.btnCancel')}
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void submitComplete()}>
              {t(language, 'tasks.btnComplete')}
            </button>
          </div>
        }
      >
        <label>
          <span>{t(language, 'tasks.notesOptional')}</span>
          <textarea className="modal-textarea" rows={3} value={completeNotes} onChange={(e) => setCompleteNotes(e.target.value)} />
        </label>
      </Modal>

      <Modal
        title={t(language, 'tasks.escalateTitle')}
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setEscalateOpen(false)}>
              {t(language, 'tasks.btnCancel')}
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void submitEscalate()}>
              {t(language, 'tasks.escalate')}
            </button>
          </div>
        }
      >
        <p className="type-caption" style={{ marginTop: 0 }}>
          {t(language, 'tasks.escalateHint')}
        </p>
        <label>
          <span>{t(language, 'tasks.notesOptional')}</span>
          <textarea className="modal-textarea" rows={3} value={escalateNote} onChange={(e) => setEscalateNote(e.target.value)} />
        </label>
      </Modal>

      <Modal
        title={t(language, 'tasks.modalCreateTitle')}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setCreateOpen(false)}>
              {t(language, 'tasks.btnCancel')}
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void submitCreate()}>
              {t(language, 'tasks.btnCreate')}
            </button>
          </div>
        }
      >
        <div className="settings-grid">
          <label>
            <span>{t(language, 'tasks.fieldTitle')} *</span>
            <input value={ctitle} onChange={(e) => setCtitle(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'tasks.fieldType')} *</span>
            <select
              value={ctype}
              onChange={(e) => {
                setCtype(e.target.value)
                if (e.target.value !== 'ad_account_linking') setCadAccountId('')
              }}
            >
              <option value="campaign_linking">{t(language, 'tasks.typeCampaignLinking')}</option>
              <option value="ad_account_linking">{t(language, 'tasks.typeAdAccountLinking')}</option>
              <option value="campaign_uploading">{t(language, 'tasks.typeCampaignUploading')}</option>
              <option value="campaign_tracking">{t(language, 'tasks.typeCampaignTracking')}</option>
              <option value="top_up_review">{t(language, 'tasks.typeTopUpReview')}</option>
              <option value="accounting">{t(language, 'tasks.typeAccounting')}</option>
            </select>
          </label>
          <label>
            <span>{t(language, 'tasks.fieldPriority')}</span>
            <select value={cpriority} onChange={(e) => setCpriority(e.target.value)}>
              <option value="low">{priorityLabel(language, 'low')}</option>
              <option value="medium">{priorityLabel(language, 'medium')}</option>
              <option value="high">{priorityLabel(language, 'high')}</option>
              <option value="urgent">{priorityLabel(language, 'urgent')}</option>
            </select>
          </label>
          <label>
            <span>{t(language, 'tasks.fieldAssignee')}</span>
            <select value={cassign} onChange={(e) => setCassign(e.target.value)}>
              <option value="">—</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t(language, 'tasks.fieldCampaignId')}</span>
            <input value={ccampaign} onChange={(e) => setCcampaign(e.target.value)} />
          </label>
          {ctype === 'ad_account_linking' ? (
            <label>
              <span>{t(language, 'tasks.fieldAdAccountId')} *</span>
              <input value={cadAccountId} onChange={(e) => setCadAccountId(e.target.value)} inputMode="numeric" />
            </label>
          ) : null}
        </div>
      </Modal>

      <Modal
        title={t(language, 'tasks.modalReassignTitle')}
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setReassignOpen(false)}>
              {t(language, 'tasks.btnCancel')}
            </button>
            <button type="button" className="primary-btn" disabled={busyId != null} onClick={() => void submitReassign()}>
              {t(language, 'tasks.btnSave')}
            </button>
          </div>
        }
      >
        <label>
          <span>{t(language, 'tasks.fieldUser')}</span>
          <select value={reassignUser} onChange={(e) => setReassignUser(e.target.value)}>
            <option value="">—</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </Modal>

      <ConfirmDialog
        open={pendingCancelId != null}
        title={t(language, 'tasks.title')}
        message={t(language, 'tasks.cancelTaskConfirm')}
        confirmLabel={t(language, 'dialog.confirm')}
        cancelLabel={t(language, 'tasks.btnCancel')}
        danger
        onCancel={() => setPendingCancelId(null)}
        onConfirm={() => void confirmCancelTask()}
      />
    </section>
  )
}
