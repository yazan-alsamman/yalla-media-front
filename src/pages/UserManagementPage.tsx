import { Eye, EyeOff, Plus, Power, UserRoundPen } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useState } from 'react'
import { ConfirmDialog } from '../components/AppDialog'
import { Modal } from '../components/Modal'
import { SectionCard } from '../components/SectionCard'
import { roleLabels } from '../data/mockData'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { roleLabel, statusLabel, t } from '../i18n'
import type { AppUser, CustomerBalanceStatus, Language, Role } from '../types'
import { currency } from '../utils/format'
import { relativeFromIso } from '../utils/time'

interface ApiUserRow {
  id: number
  name: string
  email: string
  role: string
  status: string
  balance: number
  last_login_at: string | null
  employee_type?: string | null
  customer_tier?: string | null
  balance_status?: 'ok' | 'low' | 'critical'
}

interface UsersListResponse {
  success?: boolean
  data?: ApiUserRow[]
}

/** Never assign super_admin via UI — API + seeds only */
const CREATABLE_ROLES: Role[] = ['admin', 'employee', 'accountant', 'customer']

/** Org admin (non–super_admin): customers + team only — cannot create other admins */
const ADMIN_CREATABLE_ROLES: Role[] = ['employee', 'accountant', 'customer']

const ROLE_FILTER_SUPER: Role[] = ['super_admin', 'admin', 'employee', 'accountant', 'customer']

const ROLE_FILTER_ADMIN: Role[] = ['employee', 'accountant', 'customer']

function tierLabel(language: Language, tier: string | null | undefined): string {
  const v = String(tier ?? 'normal').toLowerCase()
  if (v === 'vip') return t(language, 'users.tierVip')
  if (v === 'vvip') return t(language, 'users.tierVvip')
  return t(language, 'users.tierNormal')
}

function employeeTypeLabel(language: Language, code: string | null | undefined): string {
  const v = String(code ?? '').trim()
  if (v === 'campaign_linking') return t(language, 'roles.employeeLinking')
  if (v === 'campaign_uploading') return t(language, 'roles.employeeUploading')
  if (v === 'campaign_tracking') return t(language, 'roles.employeeTracking')
  if (v === 'accounting') return t(language, 'roles.employeeAccounting')
  return v || '—'
}

function toAppUser(row: ApiUserRow): AppUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    company: '',
    balance: row.balance,
    lastLogin: row.last_login_at ?? '',
    status: row.status,
    employee_type: row.employee_type,
    customer_tier: row.customer_tier ?? null,
    balance_status: row.balance_status,
  }
}

function balanceAlertCell(language: Language, status: CustomerBalanceStatus | undefined, role: Role) {
  if (role !== 'customer' || !status || status === 'ok') {
    return <span className="muted">—</span>
  }
  if (status === 'critical') {
    return <span className="pill pill--red">{t(language, 'users.balanceAlertCritical')}</span>
  }
  return <span className="pill pill--amber">{t(language, 'users.balanceAlertLow')}</span>
}

type Segment = 'all' | 'customers' | 'team'

export function UserManagementPage() {
  const { role, language } = useAppContext()
  const canManageRoles = role === 'super_admin' || role === 'admin'
  const [rows, setRows] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [balanceRiskFilter, setBalanceRiskFilter] = useState('')
  const [segment, setSegment] = useState<Segment>('all')

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<Role>('employee')
  const [formStatus, setFormStatus] = useState('active')
  const [formEmployeeType, setFormEmployeeType] = useState('')
  const [formCustomerTier, setFormCustomerTier] = useState('normal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [roleUserId, setRoleUserId] = useState('')
  const [roleNewRole, setRoleNewRole] = useState<Role>('employee')
  const [roleSaving, setRoleSaving] = useState(false)

  const [pendingDisableUser, setPendingDisableUser] = useState<AppUser | null>(null)
  const [showPwAdd, setShowPwAdd] = useState(false)
  const [showPwEdit, setShowPwEdit] = useState(false)

  const deferredSearch = useDeferredValue(search.trim())

  const load = useCallback(async () => {
    if (!canManageRoles) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        search: deferredSearch || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        per_page: 50,
      }
      if (segment === 'customers') params.segment = 'customers'
      if (segment === 'team') params.segment = 'team'
      if (balanceRiskFilter) params.balance_risk = balanceRiskFilter

      const res = (await api.get('/admin/users', { params })) as UsersListResponse
      const list = res?.data ?? []
      const filtered =
        segment === 'team'
          ? list.filter((u) => u.role !== 'customer')
          : segment === 'customers'
            ? list.filter((u) => u.role === 'customer')
            : list
      setRows(filtered.map(toAppUser))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [canManageRoles, deferredSearch, roleFilter, statusFilter, segment, balanceRiskFilter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (segment === 'customers' && roleFilter && roleFilter !== 'customer') {
      setRoleFilter('')
    }
    if (segment === 'team' && roleFilter === 'customer') {
      setRoleFilter('')
    }
  }, [segment, roleFilter])

  function openAdd() {
    setError(null)
    setShowPwAdd(false)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole(segment === 'customers' ? 'customer' : 'employee')
    setFormStatus('active')
    setFormEmployeeType(segment === 'customers' ? '' : 'campaign_linking')
    setFormCustomerTier('normal')
    setAddOpen(true)
  }

  function openEdit(user: AppUser) {
    setError(null)
    setShowPwEdit(false)
    setEditing(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPassword('')
    setFormRole(user.role)
    setFormStatus(user.status)
    setFormEmployeeType(user.employee_type ?? '')
    setFormCustomerTier(user.customer_tier ?? 'normal')
    setEditOpen(true)
  }

  async function submitAdd() {
    if (formRole === 'employee' && !formEmployeeType.trim()) {
      setError(t(language, 'users.employeeTypeRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.post('/admin/users', {
        name: formName.trim(),
        email: formEmail.trim(),
        password: formPassword,
        role: formRole,
        status: formStatus,
        employee_type: formRole === 'employee' && formEmployeeType ? formEmployeeType : null,
        customer_tier: formRole === 'customer' ? formCustomerTier : undefined,
      })
      setAddOpen(false)
      await load()
    } catch (e: unknown) {
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit() {
    if (!editing) return
    if (formRole === 'employee' && !formEmployeeType.trim()) {
      setError(t(language, 'users.employeeTypeRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        email: formEmail.trim(),
        status: formStatus,
        role: formRole,
        employee_type: formRole === 'employee' && formEmployeeType ? formEmployeeType : null,
        customer_tier: formRole === 'customer' ? formCustomerTier : null,
      }
      if (formPassword.trim()) body.password = formPassword.trim()
      await api.put(`/admin/users/${editing.id}`, body)
      setEditOpen(false)
      setEditing(null)
      await load()
    } catch (e: unknown) {
      setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  function requestDisableUser(user: AppUser) {
    setPendingDisableUser(user)
  }

  async function confirmDisableUser() {
    const user = pendingDisableUser
    if (!user) return
    setPendingDisableUser(null)
    try {
      await api.put(`/admin/users/${user.id}`, { status: 'inactive' })
      await load()
    } catch {
      /* toast optional */
    }
  }

  async function enableUser(user: AppUser) {
    try {
      await api.put(`/admin/users/${user.id}`, { status: 'active' })
      await load()
    } catch {
      /* ignore */
    }
  }

  async function submitRoleUpdate() {
    const id = Number(roleUserId)
    if (!id) return
    setRoleSaving(true)
    try {
      await api.put(`/admin/users/${id}`, { role: roleNewRole })
      await load()
    } finally {
      setRoleSaving(false)
    }
  }

  if (!canManageRoles) {
    return (
      <section className="page-grid">
        <div className="page-title">
          <h2>{t(language, 'users.title')}</h2>
          <p>{t(language, 'common.noPermission')}</p>
        </div>
      </section>
    )
  }

  const assignableRolesAdd: Role[] = role === 'super_admin' ? CREATABLE_ROLES : ADMIN_CREATABLE_ROLES

  const assignableRolesEdit: Role[] =
    role === 'super_admin'
      ? CREATABLE_ROLES
      : editing && !ADMIN_CREATABLE_ROLES.includes(editing.role)
        ? [...ADMIN_CREATABLE_ROLES, editing.role]
        : ADMIN_CREATABLE_ROLES

  const roleChangeOptions: Role[] = CREATABLE_ROLES
  const roleFilterOptions: Role[] = role === 'super_admin' ? ROLE_FILTER_SUPER : ROLE_FILTER_ADMIN

  return (
    <section className="page-grid">
      <div className="page-title page-title--row">
        <div>
          <h2>{t(language, 'users.title')}</h2>
          <p>{t(language, 'users.subtitle')}</p>
        </div>
        <button type="button" className="primary-btn" onClick={openAdd}>
          <Plus size={16} /> {t(language, 'users.addUser')}
        </button>
      </div>

      <div className="segment-tabs" role="tablist">
        {(['all', 'customers', 'team'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={segment === s}
            className={`segment-tabs__btn ${segment === s ? 'segment-tabs__btn--active' : ''}`}
            onClick={() => setSegment(s)}
          >
            {s === 'all' ? t(language, 'users.segmentAll') : s === 'customers' ? t(language, 'users.segmentCustomers') : t(language, 'users.segmentTeam')}
          </button>
        ))}
      </div>

      <SectionCard title={t(language, 'users.directoryTitle')}>
        <div className="filter-grid filter-grid--users">
          <input
            type="search"
            placeholder={t(language, 'users.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t(language, 'users.searchPlaceholder')}
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label={t(language, 'users.filterByRole')}>
            <option value="">{t(language, 'common.allRoles')}</option>
            {roleFilterOptions.map((r) => (
              <option key={r} value={r}>
                {roleLabel(language, r) || r}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t(language, 'users.filterByStatus')}>
            <option value="">{t(language, 'common.allStatus')}</option>
            <option value="active">{statusLabel(language, 'active')}</option>
            <option value="inactive">{statusLabel(language, 'inactive')}</option>
            <option value="suspended">{statusLabel(language, 'suspended')}</option>
          </select>
          <select
            value={balanceRiskFilter}
            onChange={(e) => setBalanceRiskFilter(e.target.value)}
            aria-label={t(language, 'users.filterBalanceRisk')}
          >
            <option value="">{t(language, 'users.balanceRiskAll')}</option>
            <option value="critical">{t(language, 'users.balanceRiskCritical')}</option>
            <option value="low">{t(language, 'users.balanceRiskLow')}</option>
            <option value="any">{t(language, 'users.balanceRiskAny')}</option>
          </select>
        </div>
        <div className="table-wrap">
          {loading ? (
            <p className="muted">{t(language, 'common.loading')}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t(language, 'users.user')}</th>
                  <th>{t(language, 'users.role')}</th>
                  <th>{t(language, 'users.customerTier')}</th>
                  <th>{t(language, 'users.status')}</th>
                  <th className="th-num">{t(language, 'users.balance')}</th>
                  <th>{t(language, 'users.balanceAlertColumn')}</th>
                  <th>{t(language, 'users.lastLogin')}</th>
                  <th>{t(language, 'users.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id} className={user.status !== 'active' ? 'row-muted' : undefined}>
                    <td>
                      <strong>{user.name}</strong>
                      <div className="user-cell__email">{user.email}</div>
                      {user.employee_type ? (
                        <div className="type-caption" style={{ marginTop: 4 }}>
                          {employeeTypeLabel(language, user.employee_type)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className="pill pill--gray">{roleLabel(language, user.role) || roleLabels[user.role] || user.role}</span>
                    </td>
                    <td>
                      {user.role === 'customer' ? (
                        <span className="pill pill--violet">{tierLabel(language, user.customer_tier)}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`pill ${
                          user.status === 'active' ? 'pill--green' : user.status === 'suspended' ? 'pill--red' : 'pill--gray'
                        }`}
                      >
                        {statusLabel(language, user.status)}
                      </span>
                    </td>
                    <td className="td-num">{currency(user.balance)}</td>
                    <td>{balanceAlertCell(language, user.balance_status, user.role)}</td>
                    <td>{relativeFromIso(language, user.lastLogin || undefined)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t(language, 'users.tooltipEdit')}
                          title={t(language, 'users.tooltipEdit')}
                          onClick={() => openEdit(user)}
                        >
                          <UserRoundPen size={15} />
                        </button>
                        {user.status === 'active' ? (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t(language, 'users.tooltipDisable')}
                            title={t(language, 'users.tooltipDisable')}
                            onClick={() => requestDisableUser(user)}
                          >
                            <Power size={15} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t(language, 'users.tooltipEnable')}
                            title={t(language, 'users.tooltipEnable')}
                            onClick={() => void enableUser(user)}
                          >
                            <Power size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>

      {role === 'super_admin' ? (
      <SectionCard title={t(language, 'users.roleControlTitle')} description={t(language, 'users.roleControlDesc')}>
        <div className="inline-form">
          <select value={roleUserId} onChange={(e) => setRoleUserId(e.target.value)} aria-label="User">
            <option value="">{t(language, 'users.selectUser')}</option>
            {rows.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <select value={roleNewRole} onChange={(e) => setRoleNewRole(e.target.value as Role)} aria-label={t(language, 'users.selectRole')}>
            {roleChangeOptions.map((r) => (
              <option key={r} value={r}>
                {roleLabel(language, r) || r}
              </option>
            ))}
          </select>
          <button type="button" className="primary-btn" disabled={!roleUserId || roleSaving} onClick={() => void submitRoleUpdate()}>
            {roleSaving ? '…' : t(language, 'users.updateRole')}
          </button>
        </div>
      </SectionCard>
      ) : null}

      <Modal
        title={t(language, 'users.addUserTitle')}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setAddOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={saving} onClick={() => void submitAdd()}>
              {saving ? '…' : t(language, 'users.saveUser')}
            </button>
          </div>
        }
      >
        {error ? <p className="login-error">{error}</p> : null}
        <div className="settings-grid">
          <label>
            <span>{t(language, 'users.fullName')}</span>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'users.emailLabel')}</span>
            <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'users.password')}</span>
            <div className="password-input-with-toggle">
              <input
                type={showPwAdd ? 'text' : 'password'}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="icon-btn icon-btn--plain"
                aria-label={showPwAdd ? t(language, 'login.hidePassword') : t(language, 'login.showPassword')}
                onClick={() => setShowPwAdd((v) => !v)}
              >
                {showPwAdd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label>
            <span>{t(language, 'users.role')}</span>
            <select
              value={formRole}
              onChange={(e) => {
                const next = e.target.value as Role
                setFormRole(next)
                if (next === 'customer') setFormEmployeeType('')
                if (next === 'employee') setFormEmployeeType((prev) => (prev.trim() ? prev : 'campaign_linking'))
                if (next !== 'customer') setFormCustomerTier('normal')
              }}
            >
              {assignableRolesAdd.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(language, r) || r}
                </option>
              ))}
            </select>
          </label>
          {formRole === 'employee' ? (
            <label>
              <span>{t(language, 'users.employeeType')}</span>
              <select value={formEmployeeType} onChange={(e) => setFormEmployeeType(e.target.value)}>
                <option value="">{t(language, 'users.selectEmployeeType')}</option>
                <option value="campaign_linking">{t(language, 'roles.employeeLinking')}</option>
                <option value="campaign_uploading">{t(language, 'roles.employeeUploading')}</option>
                <option value="campaign_tracking">{t(language, 'roles.employeeTracking')}</option>
                <option value="accounting">{t(language, 'roles.employeeAccounting')}</option>
              </select>
            </label>
          ) : null}
          {formRole === 'customer' ? (
            <label>
              <span>{t(language, 'users.customerTier')}</span>
              <select value={formCustomerTier} onChange={(e) => setFormCustomerTier(e.target.value)}>
                <option value="normal">{t(language, 'users.tierNormal')}</option>
                <option value="vip">{t(language, 'users.tierVip')}</option>
                <option value="vvip">{t(language, 'users.tierVvip')}</option>
              </select>
            </label>
          ) : null}
          <label>
            <span>{t(language, 'users.status')}</span>
            <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
            </select>
          </label>
        </div>
      </Modal>

      <Modal
        title={t(language, 'users.editUserTitle')}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        footer={
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="ghost-btn" onClick={() => setEditOpen(false)}>
              {t(language, 'users.cancel')}
            </button>
            <button type="button" className="primary-btn" disabled={saving} onClick={() => void submitEdit()}>
              {saving ? '…' : t(language, 'users.saveUser')}
            </button>
          </div>
        }
      >
        {error ? <p className="login-error">{error}</p> : null}
        <div className="settings-grid">
          <label>
            <span>{t(language, 'users.fullName')}</span>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'users.emailLabel')}</span>
            <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
          </label>
          <label>
            <span>{t(language, 'users.passwordOptional')}</span>
            <div className="password-input-with-toggle">
              <input
                type={showPwEdit ? 'text' : 'password'}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="icon-btn icon-btn--plain"
                aria-label={showPwEdit ? t(language, 'login.hidePassword') : t(language, 'login.showPassword')}
                onClick={() => setShowPwEdit((v) => !v)}
              >
                {showPwEdit ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label>
            <span>{t(language, 'users.role')}</span>
            <select
              value={formRole}
              onChange={(e) => {
                const next = e.target.value as Role
                setFormRole(next)
                if (next === 'customer') setFormEmployeeType('')
                if (next === 'employee') setFormEmployeeType((prev) => (prev.trim() ? prev : 'campaign_linking'))
                if (next !== 'customer') setFormCustomerTier('normal')
              }}
            >
              {assignableRolesEdit.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(language, r) || r}
                </option>
              ))}
            </select>
          </label>
          {formRole === 'employee' ? (
            <label>
              <span>{t(language, 'users.employeeType')}</span>
              <select value={formEmployeeType} onChange={(e) => setFormEmployeeType(e.target.value)}>
                <option value="">{t(language, 'users.selectEmployeeType')}</option>
                <option value="campaign_linking">{t(language, 'roles.employeeLinking')}</option>
                <option value="campaign_uploading">{t(language, 'roles.employeeUploading')}</option>
                <option value="campaign_tracking">{t(language, 'roles.employeeTracking')}</option>
                <option value="accounting">{t(language, 'roles.employeeAccounting')}</option>
              </select>
            </label>
          ) : null}
          {formRole === 'customer' ? (
            <label>
              <span>{t(language, 'users.customerTier')}</span>
              <select value={formCustomerTier} onChange={(e) => setFormCustomerTier(e.target.value)}>
                <option value="normal">{t(language, 'users.tierNormal')}</option>
                <option value="vip">{t(language, 'users.tierVip')}</option>
                <option value="vvip">{t(language, 'users.tierVvip')}</option>
              </select>
            </label>
          ) : null}
          <label>
            <span>{t(language, 'users.status')}</span>
            <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
            </select>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingDisableUser != null}
        title={t(language, 'users.disableUser')}
        message={t(language, 'users.disableConfirm')}
        confirmLabel={t(language, 'users.disableUser')}
        cancelLabel={t(language, 'users.cancel')}
        danger
        onCancel={() => setPendingDisableUser(null)}
        onConfirm={() => void confirmDisableUser()}
      />
    </section>
  )
}
