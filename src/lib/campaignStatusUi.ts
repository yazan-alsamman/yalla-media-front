/** Normalize API campaign status for comparisons and i18n keys. */
export function normalizeCampaignStatus(raw: string): string {
  return raw.trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_')
}

/** Pill classes for campaign status (matches table / dashboard list). */
export function campaignStatusPillClass(raw: string): string {
  const s = normalizeCampaignStatus(raw)
  if (s === 'active' || s === 'approved') return 'pill pill--green'
  if (s === 'completed') return 'pill pill--violet'
  if (s === 'pending' || s === 'pending_approval' || s === 'pending_linking') return 'pill pill--amber'
  if (s === 'rejected' || s === 'cancelled' || s === 'canceled') return 'pill pill--red'
  if (s === 'draft') return 'pill pill--gray'
  if (s === 'paused' || s === 'inactive') return 'pill pill--violet'
  return 'pill pill--gray'
}
