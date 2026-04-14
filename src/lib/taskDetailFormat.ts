import type { Language } from '../types'
import { formatDateTimeForUi } from '../utils/format'

/** Arabic labels for JSON keys in task.description (automation snapshots). */
const BLOB_LABEL_AR: Record<string, string> = {
  top_up_request_id: 'رقم طلب الشحن',
  subscription_request_id: 'رقم طلب الاشتراك',
  amount: 'المبلغ',
  notes: 'ملاحظات',
  email: 'البريد',
  name: 'الاسم',
  phone: 'الهاتف',
  campaign_id: 'رقم الحملة',
  receipt_id: 'رقم الإيصال',
  ad_account_id: 'رقم حساب الإعلان',
  meta_ad_account_id: 'معرّف ميتا لحساب الإعلان',
  platform: 'المنصة',
  customer: 'اسم العميل',
  customer_email: 'بريد العميل',
  customer_id: 'رقم العميل',
  customer_name: 'اسم العميل',
  budget: 'الميزانية',
  daily_budget: 'الميزانية اليومية',
  campaign_type: 'نوع الحملة',
  description: 'الوصف',
  payment_method: 'طريقة الدفع',
  proof_url: 'مسار إثبات الدفع',
  meta_link: 'رابط ميتا',
}

function enPrettyKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function taskBlobFieldLabel(language: Language, key: string): string {
  if (language === 'ar') {
    return BLOB_LABEL_AR[key] ?? key.replace(/_/g, ' ')
  }
  return enPrettyKey(key)
}

export function orderedBlobKeysForTaskType(taskType: string): string[] | null {
  switch (taskType) {
    case 'ad_account_linking':
      return ['name', 'meta_ad_account_id', 'ad_account_id', 'platform', 'customer', 'customer_email']
    case 'campaign_linking':
      return [
        'name',
        'campaign_id',
        'budget',
        'daily_budget',
        'campaign_type',
        'ad_account_id',
        'customer',
        'customer_email',
        'description',
      ]
    case 'campaign_tracking':
      return ['campaign_id', 'customer_name', 'customer_id', 'meta_link']
    case 'top_up_review':
      return ['top_up_request_id', 'amount', 'notes', 'payment_method', 'proof_url']
    case 'subscription_intake':
      return ['subscription_request_id', 'name', 'email', 'phone', 'notes']
    default:
      return null
  }
}

const COPY_KEYS = new Set([
  'email',
  'customer_email',
  'password',
  'temporary_password',
  'temp_password',
  'user_password',
  'initial_password',
  'generated_password',
  'meta_ad_account_id',
  'meta_link',
])

export function taskBlobKeyShouldCopy(key: string): boolean {
  if (COPY_KEYS.has(key)) return true
  return key.includes('password')
}

const ASSIGNEE_AR: Record<string, string> = {
  'linking specialist': 'أخصائي الربط',
  'tracking analyst': 'محلل المتابعة',
  accountant: 'محاسب',
  'campaign reviewer': 'مراجع الحملات',
  admin: 'مشرف',
}

export function localizeAssigneeName(language: Language, raw: string | undefined | null): string {
  if (raw == null || raw === '') return '—'
  if (language !== 'ar') return raw
  const k = raw.trim().toLowerCase()
  return ASSIGNEE_AR[k] ?? raw
}

export function localizeTaskTitle(language: Language, title: string): string {
  if (language !== 'ar' || !title) return title
  let t = title
  const rules: [RegExp, string][] = [
    [/^Link Meta ad account:\s*/i, 'ربط حساب إعلان: '],
    [/^Review top-up:\s*/i, 'مراجعة شحن: '],
    [/^Track performance:\s*/i, 'متابعة الأداء: '],
    [/^Approve campaign\s*[—-]\s*/i, 'اعتماد الحملة: '],
    [/^Verify receipt upload\s*[—-]\s*/i, 'التحقق من الإيصال: '],
    [/^New campaign needs linking\s*[—-]\s*/i, 'ربط حملة جديدة: '],
  ]
  for (const [re, rep] of rules) {
    t = t.replace(re, rep)
  }
  return t
}

export function formatTaskDueDisplay(language: Language, iso: string | undefined | null): string {
  if (iso == null || iso === '') return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return formatDateTimeForUi(language, d)
  } catch {
    return iso
  }
}

export function formatPlatformDisplay(language: Language, raw: string | undefined | null): string {
  if (raw == null || raw === '') return '—'
  const p = String(raw).toLowerCase()
  if (language === 'ar') {
    if (p === 'instagram') return 'إنستغرام'
    if (p === 'facebook') return 'فيسبوك'
  }
  return String(raw)
}

export function formatBlobValue(
  language: Language,
  key: string,
  value: unknown,
  formatCurrency: (n: number) => string,
): string {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  const s = String(value)
  if (key === 'platform') return formatPlatformDisplay(language, s)
  if (key === 'amount' || key === 'budget' || key === 'daily_budget') {
    const n = Number(value)
    if (Number.isFinite(n)) return formatCurrency(n)
  }
  return s
}
