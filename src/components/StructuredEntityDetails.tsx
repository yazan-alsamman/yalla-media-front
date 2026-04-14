import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Download, Eye, EyeOff, Minus, Plus, X } from 'lucide-react'
import { CampaignDescriptionStructured } from './CampaignDescriptionStructured'
import { useAppContext } from '../context/AppContext'
import { api } from '../lib/api'
import { useAuthorizedMediaUrl } from '../lib/authorizedMedia'
import { formatTaskDescriptionFull } from '../lib/formatTaskDescription'
import {
  formatBlobValue,
  formatPlatformDisplay,
  formatTaskDueDisplay,
  localizeAssigneeName,
  localizeTaskTitle,
  orderedBlobKeysForTaskType,
  taskBlobFieldLabel,
  taskBlobKeyShouldCopy,
} from '../lib/taskDetailFormat'
import { priorityLabel, statusLabel, taskStatLabel, taskTypeLabel, t } from '../i18n'
import type { Language } from '../types'
import { currency } from '../utils/format'

/** Meta act_* IDs vs temporary internal placeholders before OAuth/linking completes. */
function resolveMetaAdAccountDisplay(
  language: Language,
  status: string,
  raw: string,
): { text: string; allowCopy: boolean } {
  const s = raw.trim()
  const st = status.toLowerCase().replace(/-/g, '_')
  if (st === 'pending_link' || st === 'pending_linking') {
    return { text: t(language, 'adAccounts.metaIdPending'), allowCopy: false }
  }
  if (/^link_(instagram|facebook|meta)_/i.test(s) || (s.startsWith('link_') && !/^act_/i.test(s))) {
    return { text: t(language, 'adAccounts.metaIdPlaceholderValue'), allowCopy: false }
  }
  if (!s) {
    return { text: '—', allowCopy: false }
  }
  return { text: s, allowCopy: true }
}

function DetailGrid({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="detail-grid">
      {items.map((x) => (
        <div key={x.label} className="detail-row">
          <dt>{x.label}</dt>
          <dd>{x.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function str(v: unknown): string {
  if (v == null || v === '') return '—'
  return String(v)
}

function parseTaskDescriptionBlob(raw: string): Record<string, unknown> | null {
  const s = raw.trim()
  const braceIdx = s.indexOf('{')
  const slice = braceIdx >= 0 ? s.slice(braceIdx) : s
  try {
    const o = JSON.parse(slice) as unknown
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function pickPasswordFromBlob(blob: Record<string, unknown> | null): string {
  if (!blob) return ''
  const keys = [
    'password',
    'temporary_password',
    'temp_password',
    'user_password',
    'initial_password',
    'generated_password',
  ]
  for (const k of keys) {
    const v = blob[k]
    if (v != null && String(v).trim() !== '') return String(v)
  }
  return ''
}

/** Password or API token sometimes stored on ad-account linking tasks (description JSON). */
function pickLinkedCardSecret(blob: Record<string, unknown> | null): string {
  const pw = pickPasswordFromBlob(blob)
  if (pw) return pw
  if (!blob) return ''
  for (const k of ['access_token', 'access_token_plain', 'meta_access_token', 'plain_password', 'token']) {
    const v = blob[k]
    if (v != null && String(v).trim() !== '') return String(v)
  }
  return ''
}

const SECRET_KEYS_HIDE_FROM_BLOB_WHEN_LINKED_AD: Set<string> = new Set([
  'password',
  'temporary_password',
  'temp_password',
  'user_password',
  'initial_password',
  'generated_password',
  'access_token',
  'access_token_plain',
  'meta_access_token',
  'plain_password',
  'token',
])

function FieldSecretCopyRow({
  label,
  value,
  copyKey,
  language,
  onCopy,
}: {
  label: string
  value: string
  copyKey: string
  language: Language
  onCopy: (key: string, text: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const dots = '•'.repeat(Math.min(36, Math.max(10, Math.ceil(value.length / 2) + 6)))

  return (
    <div className="task-detail-field-card task-detail-field-card--secret">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="task-detail-field-card__label">{label}</div>
        <div className="task-detail-field-card__value task-detail-secret-value">{visible ? value : dots}</div>
      </div>
      <div className="task-detail-secret-actions">
        <button
          type="button"
          className="task-detail-icon-btn"
          title={visible ? t(language, 'tasks.hideSecret') : t(language, 'tasks.showSecret')}
          aria-label={visible ? t(language, 'tasks.hideSecret') : t(language, 'tasks.showSecret')}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className="task-detail-icon-btn"
          title={t(language, 'tasks.copyTooltip')}
          aria-label={t(language, 'tasks.copyTooltip')}
          onClick={() => void onCopy(copyKey, value)}
        >
          <Copy size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

function DetailFieldCopyRow({
  label,
  value,
  copyKey,
  language,
  onCopy,
}: {
  label: string
  value: string
  copyKey: string
  language: Language
  onCopy: (key: string, text: string) => void
}) {
  const hasVal = value.trim() !== ''
  return (
    <div className="task-detail-field-card">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="task-detail-field-card__label">{label}</div>
        <div className="task-detail-field-card__value">{hasVal ? value : '—'}</div>
      </div>
      <button
        type="button"
        className="task-detail-icon-btn"
        title={t(language, 'tasks.copyTooltip')}
        aria-label={t(language, 'tasks.copyTooltip')}
        disabled={!hasVal}
        onClick={() => void onCopy(copyKey, value)}
      >
        <Copy size={18} strokeWidth={2} />
      </button>
    </div>
  )
}

function DetailFieldValueRow({ label, value }: { label: string; value: string }) {
  const v = value.trim()
  return (
    <div className="task-detail-field-card task-detail-field-card--textonly">
      <div className="task-detail-field-card__label">{label}</div>
      <div className="task-detail-field-card__value">{v ? value : '—'}</div>
    </div>
  )
}

/** Employee/admin campaign detail (GET /employee/campaigns/:id) */
export function CampaignStaffDetailView({ data }: { data: Record<string, unknown> }) {
  const { language } = useAppContext()
  const base = Number(data.budget ?? 0)
  const comm = data.commission_amount != null ? Number(data.commission_amount) : null
  const tot = data.total_amount != null ? Number(data.total_amount) : base
  const items = [
    { label: 'Campaign', value: <strong>{str(data.name)}</strong> },
    { label: 'Status', value: <span className="pill pill--gray">{str(data.status)}</span> },
    { label: 'Customer', value: str(data.customer_name) },
    { label: 'Email', value: str(data.customer_email) },
    { label: t(language, 'bills.base'), value: currency(base) },
    ...(comm != null && comm > 0
      ? [
          { label: t(language, 'bills.commission'), value: currency(comm) },
          { label: t(language, 'bills.total'), value: currency(tot) },
        ]
      : []),
    { label: 'Daily budget', value: data.daily_budget != null ? currency(Number(data.daily_budget)) : '—' },
    { label: 'Spend', value: currency(Number(data.spend ?? 0)) },
    { label: 'Clicks', value: str(data.clicks) },
    { label: 'Period', value: [data.start_date, data.end_date].filter(Boolean).join(' → ') || '—' },
    { label: 'Meta link', value: data.meta_link ? <a href={String(data.meta_link)}>{String(data.meta_link).slice(0, 60)}…</a> : '—' },
    { label: 'Reject reason', value: str(data.reject_reason) },
    {
      label: 'Description',
      value: <CampaignDescriptionStructured raw={data.description != null ? String(data.description) : ''} />,
    },
  ]
  return <DetailGrid items={items} />
}

/** Customer campaign (GET /customer/campaigns/:id) */
export function CampaignCustomerDetailView({ data }: { data: Record<string, unknown> }) {
  const items = [
    { label: 'Campaign', value: <strong>{str(data.name)}</strong> },
    { label: 'Status', value: <span className="pill pill--gray">{str(data.status)}</span> },
    { label: 'Daily budget', value: currency(Number(data.dailyBudget ?? 0)) },
    { label: 'Total spend', value: currency(Number(data.totalSpending ?? 0)) },
    { label: 'Clicks', value: str(data.clicks) },
    { label: 'Impressions', value: str(data.impressions) },
    { label: 'Platform', value: str(data.platform) },
    { label: 'Created', value: str(data.createdAt) },
    ...(data.description != null && String(data.description).trim() !== ''
      ? [
          {
            label: 'Description',
            value: <CampaignDescriptionStructured raw={String(data.description)} />,
          },
        ]
      : []),
  ]
  return <DetailGrid items={items} />
}

export function CampaignInsightsView({ data }: { data: Record<string, unknown> }) {
  const items = [
    { label: 'Campaign ID', value: str(data.campaign_id) },
    { label: 'Clicks', value: str(data.clicks) },
    { label: 'Impressions', value: str(data.impressions) },
    { label: 'Spend', value: currency(Number(data.spend ?? 0)) },
  ]
  return <DetailGrid items={items} />
}

export function AdAccountDetailView({ data }: { data: Record<string, unknown> }) {
  const { language } = useAppContext()
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  const copyText = useCallback(async (_key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }, [])

  const customerName = String(data.customer_name ?? '').trim()
  const customerEmail = String(data.customer_email ?? '').trim()
  const contactStr = String(data.contact ?? '').trim()
  const emailForCopy = customerEmail || (contactStr.includes('@') ? contactStr : '')
  const contactDuplicatesEmail = contactStr.includes('@') && contactStr === emailForCopy
  const showContactRow = contactStr !== '' && !contactDuplicatesEmail
  const tokenStr = String(data.access_token ?? '').trim()
  const showCustomerBlock = customerName !== '' || customerEmail !== ''

  return (
    <div className="task-detail-modal-root">
      <section className="task-detail-payload-block">
        <h4 className="task-detail-section-title">{t(language, 'adAccounts.sectionSummary')}</h4>
        <DetailFieldValueRow label={t(language, 'tasks.fieldTitle')} value={String(data.name ?? '')} />
        <DetailFieldValueRow
          label={t(language, 'adAccounts.platform')}
          value={formatPlatformDisplay(language, data.platform != null ? String(data.platform) : null)}
        />
        <DetailFieldValueRow label={t(language, 'users.status')} value={statusLabel(language, String(data.status ?? ''))} />
        <DetailFieldValueRow label={t(language, 'adAccounts.currency')} value={String(data.currency ?? '')} />
        <DetailFieldValueRow label={t(language, 'adAccounts.timezone')} value={String(data.timezone ?? '')} />
        {data.page_url != null && String(data.page_url).trim() !== '' ? (
          <div className="task-detail-field-card task-detail-field-card--textonly">
            <div className="task-detail-field-card__label">{t(language, 'adAccounts.pageUrl')}</div>
            <div className="task-detail-field-card__value">
              <a href={String(data.page_url)} target="_blank" rel="noreferrer">
                {String(data.page_url)}
              </a>
            </div>
          </div>
        ) : (
          <DetailFieldValueRow label={t(language, 'adAccounts.pageUrl')} value="" />
        )}
        {showContactRow ? <DetailFieldValueRow label={t(language, 'adAccounts.contact')} value={contactStr} /> : null}
      </section>

      {showCustomerBlock ? (
        <section className="task-detail-payload-block">
          <h4 className="task-detail-section-title">{t(language, 'adAccounts.sectionCustomer')}</h4>
          <DetailFieldValueRow label={t(language, 'adAccounts.customerName')} value={customerName} />
          <DetailFieldCopyRow
            label={t(language, 'adAccounts.customerEmail')}
            value={emailForCopy}
            copyKey="customer-email"
            language={language}
            onCopy={(k, text) => void copyText(k, text)}
          />
        </section>
      ) : emailForCopy !== '' ? (
        <section className="task-detail-payload-block">
          <h4 className="task-detail-section-title">{t(language, 'adAccounts.sectionCustomer')}</h4>
          <DetailFieldCopyRow
            label={t(language, 'adAccounts.customerEmail')}
            value={emailForCopy}
            copyKey="contact-email"
            language={language}
            onCopy={(k, text) => void copyText(k, text)}
          />
        </section>
      ) : null}

      <section className="task-detail-payload-block">
        <h4 className="task-detail-section-title">{t(language, 'adAccounts.sectionIdentifiers')}</h4>
        {(() => {
          const metaDisp = resolveMetaAdAccountDisplay(
            language,
            String(data.status ?? ''),
            String(data.meta_ad_account_id ?? ''),
          )
          return metaDisp.allowCopy ? (
            <DetailFieldCopyRow
              label={t(language, 'adAccounts.metaId')}
              value={metaDisp.text}
              copyKey="ad-meta-id"
              language={language}
              onCopy={(k, text) => void copyText(k, text)}
            />
          ) : (
            <DetailFieldValueRow label={t(language, 'adAccounts.metaId')} value={metaDisp.text} />
          )
        })()}
        <DetailFieldValueRow label={t(language, 'tasks.detailInternalAdId')} value={data.id != null ? `#${String(data.id)}` : ''} />
      </section>

      {tokenStr !== '' ? (
        <section className="task-detail-payload-block">
          <h4 className="task-detail-section-title">{t(language, 'adAccounts.sectionSecret')}</h4>
          <FieldSecretCopyRow
            label={t(language, 'adAccounts.accessSecret')}
            value={tokenStr}
            copyKey="ad-access-token"
            language={language}
            onCopy={(k, text) => void copyText(k, text)}
          />
        </section>
      ) : null}
    </div>
  )
}

export function TaskDetailView({
  data,
  onMutate,
}: {
  data: Record<string, unknown>
  onMutate?: () => void
}) {
  const navigate = useNavigate()
  const { language, role, currentUser } = useAppContext()
  const taskType = String(data.type ?? '')
  const tur = data.top_up_request as Record<string, unknown> | undefined
  const proofPath = tur?.proof_url != null ? String(tur.proof_url) : ''
  const { url: proofBlobUrl, failed: proofLoadFailed, loading: proofLoading } = useAuthorizedMediaUrl(proofPath)
  const descRaw = data.description != null ? String(data.description) : ''
  const descBlob = parseTaskDescriptionBlob(descRaw)
  const creatorName = data.creator_name != null ? String(data.creator_name) : ''
  const fromSuper = data.created_by_super_admin === true
  const adAcc = data.ad_account as Record<string, unknown> | undefined
  const sub = data.subscription_request as Record<string, unknown> | undefined
  const accReq = data.account_request as Record<string, unknown> | undefined

  const taskAdAccountId = useMemo(() => {
    if (taskType !== 'ad_account_linking') return null
    const fromRoot = data.ad_account_id
    if (fromRoot != null && Number.isFinite(Number(fromRoot))) return Number(fromRoot)
    if (adAcc && adAcc.id != null && Number.isFinite(Number(adAcc.id))) return Number(adAcc.id)
    const blob = parseTaskDescriptionBlob(descRaw)
    if (blob?.ad_account_id != null && Number.isFinite(Number(blob.ad_account_id))) return Number(blob.ad_account_id)
    return null
  }, [taskType, data.ad_account_id, adAcc, descRaw])

  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [notifyBusy, setNotifyBusy] = useState(false)
  const [notifyOk, setNotifyOk] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [financeBusy, setFinanceBusy] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  const copyText = useCallback(
    async (key: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedKey(key)
        if (copyTimer.current) clearTimeout(copyTimer.current)
        copyTimer.current = setTimeout(() => setCopiedKey(null), 2200)
      } catch {
        setCopiedKey(null)
      }
    },
    [],
  )

  const taskId = data.id != null ? Number(data.id) : NaN
  const topUpId = tur?.id != null ? Number(tur.id) : NaN
  const topUpPending = String(tur?.status ?? '') === 'pending'

  const canApproveTopUp =
    role === 'accountant' ||
    role === 'admin' ||
    role === 'super_admin' ||
    (role === 'employee' && currentUser?.employee_type === 'accounting')

  const emailForAccount =
    (descBlob?.email != null && String(descBlob.email).trim() !== '' ? String(descBlob.email) : '') ||
    (sub?.email != null ? String(sub.email) : '') ||
    ''

  const passwordForAccount = pickPasswordFromBlob(descBlob)

  async function sendPasswordNotify() {
    if (!Number.isFinite(taskId)) return
    setNotifyBusy(true)
    setNotifyOk(false)
    try {
      await api.post(`/tasks/${taskId}/notify-password-change`)
      setNotifyOk(true)
    } catch {
      setNotifyOk(false)
    } finally {
      setNotifyBusy(false)
    }
  }

  async function approveTopUp() {
    if (!Number.isFinite(topUpId)) return
    setFinanceBusy(true)
    try {
      await api.post(`/accountant/top-up-requests/${topUpId}/approve`)
      onMutate?.()
    } finally {
      setFinanceBusy(false)
    }
  }

  async function rejectTopUp() {
    if (!Number.isFinite(topUpId)) return
    setFinanceBusy(true)
    try {
      await api.post(`/accountant/top-up-requests/${topUpId}/reject`, {
        reason: rejectReason.trim() || undefined,
      })
      setRejectOpen(false)
      setRejectReason('')
      onMutate?.()
    } finally {
      setFinanceBusy(false)
    }
  }

  const provisioningSkipKeys = new Set([
    'email',
    'password',
    'temporary_password',
    'temp_password',
    'user_password',
    'initial_password',
    'generated_password',
  ])

  const summaryItems = [
    {
      label: t(language, 'tasks.fieldTitle'),
      value: <strong>{localizeTaskTitle(language, String(data.title ?? ''))}</strong>,
    },
    { label: t(language, 'tasks.type'), value: taskTypeLabel(language, taskType) },
    {
      label: t(language, 'accountantWorkspace.colStatus'),
      value: <span className="pill pill--gray">{taskStatLabel(language, String(data.status ?? ''))}</span>,
    },
    { label: t(language, 'tasks.priority'), value: priorityLabel(language, String(data.priority ?? '')) },
    {
      label: t(language, 'tasks.assignee'),
      value: localizeAssigneeName(language, data.assignee_name != null ? String(data.assignee_name) : ''),
    },
    ...(creatorName
      ? [
          {
            label: t(language, 'tasks.detailCreator'),
            value: (
              <span>
                {creatorName}
                {fromSuper ? ` · ${t(language, 'tasks.superAdminTaskShort')}` : ''}
              </span>
            ),
          },
        ]
      : []),
    { label: t(language, 'tasks.fieldCampaignId'), value: str(data.campaign_id) },
    {
      label: t(language, 'tasks.detailTopUp'),
      value: tur?.id != null ? `#${str(tur.id)} · ${str(tur.user_name)}` : '—',
    },
    {
      label: t(language, 'tasks.detailDue'),
      value: formatTaskDueDisplay(language, data.due_date != null ? String(data.due_date) : null),
    },
    ...(data.notes != null && String(data.notes).trim() !== ''
      ? [
          {
            label: t(language, 'tasks.detailNotes'),
            value: <span className="task-detail-notes-inline">{str(data.notes)}</span>,
          },
        ]
      : []),
  ]

  function renderBlobPayloadSection() {
    if (!descBlob) return null
    if (taskType === 'top_up_review' && tur?.id != null) return null

    const order = orderedBlobKeysForTaskType(taskType) ?? Object.keys(descBlob).sort()
    const nodes: ReactNode[] = []
    for (const key of order) {
      if (!Object.prototype.hasOwnProperty.call(descBlob, key)) continue
      if (
        key === 'campaign_id' &&
        data.campaign &&
        typeof data.campaign === 'object' &&
        !Array.isArray(data.campaign) &&
        (data.campaign as Record<string, unknown>).id != null
      ) {
        continue
      }
      if (taskType === 'account_provisioning' && provisioningSkipKeys.has(key)) continue
      if (
        sub &&
        (taskType === 'subscription_intake' || taskType === 'account_provisioning') &&
        ['subscription_request_id', 'name', 'email', 'phone', 'notes'].includes(key)
      ) {
        continue
      }
      if (
        accReq &&
        taskType === 'account_request_review' &&
        ['account_request_id', 'full_name', 'whatsapp'].includes(key)
      ) {
        continue
      }
      if (adAcc?.id != null && SECRET_KEYS_HIDE_FROM_BLOB_WHEN_LINKED_AD.has(key)) {
        continue
      }
      const rawVal = descBlob[key]
      if (rawVal == null || rawVal === '') continue
      if (taskType === 'top_up_review' && tur?.id != null) {
        if (key === 'top_up_request_id' && String(rawVal) === String(tur.id)) continue
        if (key === 'amount' && Math.abs(Number(rawVal) - Number(tur.amount ?? 0)) < 0.0001) continue
      }
      const label = taskBlobFieldLabel(language, key)
      const display = formatBlobValue(language, key, rawVal, currency)

      if (key === 'description') {
        nodes.push(
          <div key={key} className="task-detail-field-card task-detail-field-card--block">
            <div className="task-detail-field-card__label">{label}</div>
            <CampaignDescriptionStructured raw={String(rawVal)} />
          </div>,
        )
        continue
      }

      if (taskBlobKeyShouldCopy(key)) {
        nodes.push(
          <DetailFieldCopyRow
            key={key}
            label={label}
            value={display}
            copyKey={`blob-${key}`}
            language={language}
            onCopy={(k, text) => void copyText(k, text)}
          />,
        )
      } else {
        nodes.push(<DetailFieldValueRow key={key} label={label} value={display} />)
      }
    }
    if (nodes.length === 0) return null
    return (
      <section className="task-detail-payload-block">
        <h4 className="task-detail-section-title">{t(language, 'tasks.detailPayloadSection')}</h4>
        {nodes}
      </section>
    )
  }

  const showPlainNote = !descBlob && descRaw.trim().length > 0
  const linkedAdSecret = pickLinkedCardSecret(descBlob)

  return (
    <>
      <section className="task-detail-summary-card">
        <h4 className="task-detail-section-title">{t(language, 'tasks.detailSummarySection')}</h4>
        <DetailGrid items={summaryItems} />
      </section>

      {taskAdAccountId != null ? (
        <section className="task-detail-payload-block">
          <button
            type="button"
            className="primary-btn"
            onClick={() => navigate(`/ad-accounts?open=${taskAdAccountId}`)}
          >
            {t(language, 'tasks.openAdAccountsForLinking')}
          </button>
          <p className="muted type-caption" style={{ marginTop: 10, marginBottom: 0 }}>
            {t(language, 'tasks.openAdAccountsForLinkingHint')}
          </p>
        </section>
      ) : null}

      {(() => {
        const camp = data.campaign
        if (!camp || typeof camp !== 'object' || Array.isArray(camp)) return null
        const c = camp as Record<string, unknown>
        if (c.id == null) return null
        return (
          <section className="task-detail-payload-block">
            <h4 className="task-detail-section-title">{t(language, 'campaigns.campaign')}</h4>
            <CampaignStaffDetailView data={c} />
          </section>
        )
      })()}

      {adAcc?.id != null ? (
        <section className="task-detail-payload-block">
          <h4 className="task-detail-section-title">{t(language, 'tasks.detailLinkedAdAccount')}</h4>
          <DetailFieldValueRow label={taskBlobFieldLabel(language, 'name')} value={str(adAcc.name)} />
          <DetailFieldValueRow
            label={taskBlobFieldLabel(language, 'platform')}
            value={formatPlatformDisplay(language, adAcc.platform != null ? String(adAcc.platform) : null)}
          />
          {(() => {
            const metaDisp = resolveMetaAdAccountDisplay(
              language,
              String(adAcc.status ?? ''),
              String(adAcc.meta_ad_account_id ?? ''),
            )
            return metaDisp.allowCopy ? (
              <DetailFieldCopyRow
                label={taskBlobFieldLabel(language, 'meta_ad_account_id')}
                value={metaDisp.text}
                copyKey="ad-meta-id"
                language={language}
                onCopy={(k, text) => void copyText(k, text)}
              />
            ) : (
              <DetailFieldValueRow label={taskBlobFieldLabel(language, 'meta_ad_account_id')} value={metaDisp.text} />
            )
          })()}
          <DetailFieldValueRow label={t(language, 'tasks.detailInternalAdId')} value={`#${str(adAcc.id)}`} />
          {linkedAdSecret.trim() !== '' ? (
            <FieldSecretCopyRow
              label={t(language, 'tasks.detailPassword')}
              value={linkedAdSecret}
              copyKey="linked-ad-secret"
              language={language}
              onCopy={(k, text) => void copyText(k, text)}
            />
          ) : null}
        </section>
      ) : null}

      {sub && (taskType === 'subscription_intake' || taskType === 'account_provisioning') ? (
        <section className="task-detail-payload-block">
          <h4 className="task-detail-section-title">{t(language, 'tasks.detailSubscriptionSection')}</h4>
          <DetailFieldValueRow label={taskBlobFieldLabel(language, 'name')} value={str(sub.name)} />
          <DetailFieldCopyRow
            label={taskBlobFieldLabel(language, 'email')}
            value={str(sub.email)}
            copyKey="sub-email"
            language={language}
            onCopy={(k, text) => void copyText(k, text)}
          />
          <DetailFieldValueRow label={taskBlobFieldLabel(language, 'phone')} value={str(sub.phone)} />
          <DetailFieldValueRow label={taskBlobFieldLabel(language, 'notes')} value={str(sub.notes)} />
        </section>
      ) : null}

      {accReq && taskType === 'account_request_review' ? (
        <section className="task-detail-payload-block">
          <h4 className="task-detail-section-title">{t(language, 'accountRequests.title')}</h4>
          <DetailFieldValueRow label={t(language, 'accountRequests.fullName')} value={str(accReq.full_name)} />
          <DetailFieldCopyRow
            label={t(language, 'accountRequests.whatsapp')}
            value={str(accReq.whatsapp)}
            copyKey="acc-whatsapp"
            language={language}
            onCopy={(k, text) => void copyText(k, text)}
          />
          <DetailFieldValueRow label={t(language, 'users.status')} value={str(accReq.status)} />
        </section>
      ) : null}

      {renderBlobPayloadSection()}

      {showPlainNote ? (
        <section className="task-detail-payload-block">
          <h4 className="task-detail-section-title">{t(language, 'tasks.detailPlainNote')}</h4>
          <pre className="task-detail-multiline">{formatTaskDescriptionFull(descRaw)}</pre>
        </section>
      ) : null}

      {taskType === 'account_provisioning' ? (
        <div className="task-detail-payload-block" style={{ marginTop: 4 }}>
          <h4 className="task-detail-section-title">{t(language, 'tasks.detailSectionAccount')}</h4>
          <DetailFieldCopyRow
            label={t(language, 'tasks.detailEmail')}
            value={emailForAccount}
            copyKey="email"
            language={language}
            onCopy={(k, text) => void copyText(k, text)}
          />
          {passwordForAccount.trim() !== '' ? (
            <FieldSecretCopyRow
              label={t(language, 'tasks.detailPassword')}
              value={passwordForAccount}
              copyKey="password"
              language={language}
              onCopy={(k, text) => void copyText(k, text)}
            />
          ) : (
            <DetailFieldCopyRow
              label={t(language, 'tasks.detailPassword')}
              value=""
              copyKey="password"
              language={language}
              onCopy={(k, text) => void copyText(k, text)}
            />
          )}
          <button
            type="button"
            className="primary-btn"
            style={{ marginTop: 14 }}
            disabled={notifyBusy || !Number.isFinite(taskId)}
            onClick={() => void sendPasswordNotify()}
          >
            {notifyBusy ? t(language, 'tasks.notifyPasswordSending') : t(language, 'tasks.notifyPasswordChange')}
          </button>
          {notifyOk ? (
            <div className="task-detail-toast" role="status" style={{ marginTop: 8 }}>
              {t(language, 'tasks.notifyPasswordSent')}
            </div>
          ) : null}
        </div>
      ) : null}

      {taskType === 'top_up_review' && tur?.id != null ? (
        <div className="task-detail-payload-block">
          <h4 className="task-detail-section-title">{t(language, 'tasks.paymentCardTitle')}</h4>
          <div className="task-payment-card">
            <div>
              <div className="task-payment-card__k">{t(language, 'tasks.paymentAmount')}</div>
              <div className="task-payment-card__v">{currency(Number(tur.amount ?? 0))}</div>
            </div>
            <div>
              <div className="task-payment-card__k">{t(language, 'tasks.paymentDate')}</div>
              <div className="task-payment-card__v">
                {formatTaskDueDisplay(language, tur.created_at != null ? String(tur.created_at) : null)}
              </div>
            </div>
            <div>
              <div className="task-payment-card__k">{t(language, 'tasks.paymentStatus')}</div>
              <div className="task-payment-card__v">
                <span className="pill pill--gray">{statusLabel(language, String(tur.status ?? ''))}</span>
              </div>
            </div>
          </div>

          {proofPath.trim() ? (
            <div style={{ marginTop: 4 }}>
              <h4 className="task-detail-section-title">{t(language, 'tasks.detailProof')}</h4>
              {proofLoadFailed ? (
                <p className="muted type-caption">{t(language, 'tasks.proofLoadFailed')}</p>
              ) : proofLoading || !proofBlobUrl ? (
                <div className="task-receipt-thumb task-receipt-thumb--skeleton" aria-busy="true" />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1)
                    setLightbox(true)
                  }}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    borderRadius: 10,
                    cursor: 'zoom-in',
                  }}
                >
                  <img
                    className="task-receipt-thumb"
                    src={proofBlobUrl}
                    alt={t(language, 'tasks.detailProofAlt')}
                  />
                </button>
              )}
            </div>
          ) : null}

          {canApproveTopUp && topUpPending ? (
            <div className="task-detail-actions">
              <button type="button" className="primary-btn" disabled={financeBusy} onClick={() => void approveTopUp()}>
                <Check size={16} aria-hidden /> {t(language, 'tasks.approvePayment')}
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={financeBusy}
                onClick={() => setRejectOpen((v) => !v)}
              >
                <X size={16} aria-hidden /> {t(language, 'tasks.rejectPayment')}
              </button>
            </div>
          ) : null}

          {rejectOpen ? (
            <label style={{ display: 'block', marginTop: 12 }}>
              <span className="type-caption">{t(language, 'tasks.rejectReasonShort')}</span>
              <textarea
                className="modal-textarea"
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="row-actions" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="ghost-btn" onClick={() => setRejectOpen(false)}>
                  {t(language, 'tasks.btnCancel')}
                </button>
                <button type="button" className="primary-btn" disabled={financeBusy} onClick={() => void rejectTopUp()}>
                  {t(language, 'tasks.rejectPayment')}
                </button>
              </div>
            </label>
          ) : null}
        </div>
      ) : null}

      {copiedKey ? (
        <div className="task-detail-toast task-detail-toast--global" role="status">
          {t(language, 'tasks.copiedToast')}
        </div>
      ) : null}

      {lightbox && proofBlobUrl ? (
        <div
          className="receipt-lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t(language, 'tasks.receiptOpen')}
          onClick={() => setLightbox(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightbox(false)
          }}
        >
          <div className="receipt-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-lightbox-toolbar">
              <button
                type="button"
                className="task-detail-icon-btn"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)' }}
                title={t(language, 'tasks.receiptZoomOut')}
                onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
              >
                <Minus size={18} />
              </button>
              <button
                type="button"
                className="task-detail-icon-btn"
                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)' }}
                title={t(language, 'tasks.receiptZoomIn')}
                onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
              >
                <Plus size={18} />
              </button>
              <a
                className="ghost-btn"
                href={proofBlobUrl}
                download="proof"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  borderColor: 'rgba(255,255,255,0.35)',
                  color: '#fff',
                }}
              >
                <Download size={16} /> {t(language, 'tasks.receiptDownload')}
              </a>
              <button
                type="button"
                className="ghost-btn"
                style={{ borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}
                onClick={() => setLightbox(false)}
              >
                <X size={16} /> {t(language, 'tasks.lightboxClose')}
              </button>
            </div>
            <div className="receipt-lightbox-img-wrap">
              <img
                className="receipt-lightbox-img"
                src={proofBlobUrl}
                alt={t(language, 'tasks.detailProofAlt')}
                style={{ transform: `scale(${zoom})` }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

/** Read-only key/value for arbitrary API objects (e.g. receipts). */
/** Accountant receipt (GET /accountant/receipts/:id) */
export function AccountantReceiptDetailView({ data }: { data: Record<string, unknown> }) {
  const filePath = data.file_path != null ? String(data.file_path) : ''
  const items = [
    { label: 'Receipt #', value: <strong>{str(data.receipt_number ?? data.id)}</strong> },
    { label: 'Status', value: <span className="pill pill--gray">{str(data.status)}</span> },
    { label: 'Amount', value: currency(Number(data.amount ?? 0)) },
    { label: 'Customer', value: str(data.user_name) },
    { label: 'Email', value: str(data.user_email) },
    { label: 'Notes', value: <span className="muted" style={{ whiteSpace: 'pre-wrap' }}>{str(data.notes)}</span> },
    {
      label: 'File',
      value:
        filePath && (filePath.startsWith('http://') || filePath.startsWith('https://')) ? (
          <a href={filePath}>Open file</a>
        ) : filePath ? (
          <span className="muted" style={{ wordBreak: 'break-all' }}>
            {filePath}
          </span>
        ) : (
          '—'
        ),
    },
  ]
  return <DetailGrid items={items} />
}

export function KeyValueRecordView({ data }: { data: Record<string, unknown> }) {
  const items = Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k]
      let value: ReactNode
      if (v == null) value = '—'
      else if (typeof v === 'object' && !Array.isArray(v)) {
        value = (
          <pre className="muted" style={{ fontSize: 11, margin: 0, whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(v, null, 2)}
          </pre>
        )
      } else if (Array.isArray(v)) {
        value = <span className="muted">{v.length} items</span>
      } else {
        value = String(v)
      }
      return { label: k.replace(/_/g, ' '), value }
    })
  return <DetailGrid items={items} />
}
