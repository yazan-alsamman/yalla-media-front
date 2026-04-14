/** Normalizes API payload (Arabic keys from Laravel job) for the dashboard. */

export type DailyReportParsed = {
  date: string
  generatedAt: string
  newUsers: number
  newCampaigns: number
  totalCustomerBalances: number
  zeroOrLessWallets: number
  negativeBalanceAccounts: number
  incompleteTasks: number
  pendingTopUps: number
  totalCustomers: number
  totalCampaigns: number
  campaignsByStatus: Record<string, number>
  metaDaySpend: number
  metaDayClicks: number
  metaDayImpressions: number
  lowBalanceWallets: number
  accountRequestsPending: number
  adAccountsTotal: number
  adAccountsPendingLink: number
  invoicesUnpaid: number
  transactionsToday: number
}

function firstKey(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k]
  }
  return undefined
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function str(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

function recordOfNumbers(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, number> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = num(val)
  }
  return out
}

export function parseDailyReportPayload(raw: Record<string, unknown> | null | undefined): DailyReportParsed | null {
  if (!raw || typeof raw !== 'object') return null

  const balancesRaw = firstKey(raw, ['الأرصدة', 'balances'])
  const balances =
    balancesRaw && typeof balancesRaw === 'object' && !Array.isArray(balancesRaw)
      ? (balancesRaw as Record<string, unknown>)
      : {}

  const summaryRaw = firstKey(raw, ['platform_summary', 'ملخص_المنصة'])
  const summary =
    summaryRaw && typeof summaryRaw === 'object' && !Array.isArray(summaryRaw)
      ? (summaryRaw as Record<string, unknown>)
      : {}

  const metaRaw = firstKey(raw, ['meta_insights_day', 'إعلانات_meta_اليوم'])
  const meta =
    metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw) ? (metaRaw as Record<string, unknown>) : {}

  const adRaw = firstKey(raw, ['ad_accounts', 'حسابات_إعلان'])
  const ad =
    adRaw && typeof adRaw === 'object' && !Array.isArray(adRaw) ? (adRaw as Record<string, unknown>) : {}

  return {
    date: str(firstKey(raw, ['التاريخ', 'report_date', 'date'])),
    generatedAt: str(firstKey(raw, ['أنشئ_في', 'generated_at', 'created_at'])),
    newUsers: num(firstKey(raw, ['مستخدمون_جدد', 'new_users', 'newCustomers'])),
    newCampaigns: num(firstKey(raw, ['حملات_جديدة', 'new_campaigns', 'newCampaigns'])),
    totalCustomerBalances: num(
      firstKey(balances, ['إجمالي_أرصدة_العملاء', 'total_customer_balances', 'totalCustomerBalances']),
    ),
    zeroOrLessWallets: num(
      firstKey(balances, ['عدد_محافظ_صفر_أو_أقل', 'zero_or_less_wallets', 'zeroOrLessWallets']),
    ),
    negativeBalanceAccounts: num(firstKey(raw, ['حسابات_برصيد_سالب', 'negative_balance_accounts', 'negativeBalanceAccounts'])),
    incompleteTasks: num(firstKey(raw, ['مهام_غير_مكتملة', 'incomplete_tasks', 'open_tasks', 'incompleteTasks'])),
    pendingTopUps: num(firstKey(raw, ['طلبات_شحن_معلقة', 'pending_top_ups', 'pendingTopUps'])),
    totalCustomers: num(firstKey(summary, ['total_customers', 'عملاء_إجمالي'])),
    totalCampaigns: num(firstKey(summary, ['total_campaigns', 'حملات_إجمالي'])),
    campaignsByStatus: recordOfNumbers(firstKey(raw, ['campaigns_by_status', 'حملات_حسب_الحالة'])),
    metaDaySpend: num(firstKey(meta, ['spend', 'إنفاق'])),
    metaDayClicks: num(firstKey(meta, ['clicks', 'نقرات'])),
    metaDayImpressions: num(firstKey(meta, ['impressions', 'ظهور'])),
    lowBalanceWallets: num(firstKey(raw, ['low_balance_wallets', 'محافظ_رصيد_منخفض'])),
    accountRequestsPending: (() => {
      const direct = firstKey(raw, ['account_requests_pending', 'طلبات_إنشاء_حساب_معلقة'])
      if (direct !== undefined) return num(direct)
      return num(firstKey(raw, ['subscription_requests_pending', 'طلبات_اشتراك_معلقة']))
    })(),
    adAccountsTotal: num(firstKey(ad, ['total', 'إجمالي'])),
    adAccountsPendingLink: num(firstKey(ad, ['pending_link', 'بانتظار_ربط'])),
    invoicesUnpaid: num(firstKey(raw, ['invoices_unpaid', 'فواتير_غير_مدفوعة'])),
    transactionsToday: num(firstKey(raw, ['transactions_today', 'حركات_اليوم'])),
  }
}
