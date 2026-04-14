import type { Role } from '../types'

/** Sidebar / route keys used by AppShell + mockData nav. */
export function getNavKeys(role: Role, employeeType: string | null | undefined): string[] {
  const et = employeeType ?? null

  const superAdmin: string[] = [
    'dashboard',
    'admin_pulse',
    'users',
    'account_requests',
    'campaigns',
    'campaign_tracking',
    'ad_accounts',
    'integrations',
    'billing',
    'bills',
    'top_up_methods',
    'tasks',
    'campaign_types',
    'reports',
    'daily_report',
    'notifications',
    'settings',
  ]

  const admin: string[] = [
    'dashboard',
    'users',
    'account_requests',
    'tasks',
    'notifications',
    'settings',
  ]

  if (role === 'super_admin') return superAdmin
  if (role === 'admin') return admin

  if (role === 'accountant') {
    return ['dashboard', 'workspace', 'top_up_methods', 'bills', 'tasks', 'notifications', 'settings']
  }

  if (role === 'customer') {
    return ['dashboard', 'campaigns', 'ad_accounts', 'integrations', 'billing', 'bills', 'notifications', 'settings']
  }

  if (role === 'employee') {
    if (et === 'campaign_linking') {
      return ['dashboard', 'ad_accounts', 'campaigns', 'campaign_tracking', 'tasks', 'notifications', 'settings']
    }
    if (et === 'campaign_uploading') {
      return ['dashboard', 'campaigns', 'campaign_tracking', 'tasks', 'notifications', 'settings']
    }
    if (et === 'campaign_tracking') {
      return ['dashboard', 'campaigns', 'campaign_tracking', 'tasks', 'notifications', 'settings']
    }
    if (et === 'accounting') {
      return ['dashboard', 'workspace', 'top_up_methods', 'bills', 'tasks', 'notifications', 'settings']
    }
    return ['dashboard', 'campaigns', 'tasks', 'notifications', 'settings']
  }

  return ['dashboard', 'notifications', 'settings']
}

/** If non-null, tasks list is filtered to these API `type` values. */
export function taskTypesForStaff(role: Role, employeeType: string | null | undefined): string[] | null {
  const et = employeeType ?? null
  if (role === 'admin') {
    return ['subscription_intake', 'account_provisioning', 'account_request_review']
  }
  if (role === 'accountant' || (role === 'employee' && et === 'accounting')) {
    return ['top_up_review', 'accounting']
  }
  if (role === 'employee') {
    if (et === 'campaign_linking') return ['campaign_linking', 'ad_account_linking']
    if (et === 'campaign_uploading') return ['campaign_uploading']
    if (et === 'campaign_tracking') return ['campaign_tracking']
  }
  return null
}

export function canEmployeeEscalateTasks(employeeType: string | null | undefined): boolean {
  return employeeType !== 'campaign_tracking'
}

export type StaffCampaignUIMode = 'customer' | 'none' | 'full' | 'linking' | 'uploading' | 'tracking'

export function getStaffCampaignUIMode(role: Role, employeeType: string | null | undefined): StaffCampaignUIMode {
  if (role === 'customer') return 'customer'
  if (role === 'admin') return 'none'
  if (role === 'super_admin') return 'full'
  if (role !== 'employee') return 'none'
  switch (employeeType) {
    case 'campaign_linking':
      return 'linking'
    case 'campaign_uploading':
      return 'uploading'
    case 'campaign_tracking':
      return 'tracking'
    default:
      return 'full'
  }
}
