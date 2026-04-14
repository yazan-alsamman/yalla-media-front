export type Role = 'super_admin' | 'admin' | 'employee' | 'accountant' | 'customer'
export type Language = 'ar'

export type CampaignStatus =
  | 'active'
  | 'pending'
  | 'pending_approval'
  | 'pending_linking'
  | 'approved'
  | 'rejected'
  | 'paused'
  | 'draft'

/** Logged-in user from `GET /auth/me` (Laravel). */
export interface AuthUser {
  id: number
  name: string
  email: string
  role: Role
  phone?: string | null
  status?: string
  language?: string
  theme?: string
  /** Laravel `users.employee_type` (campaign_linking, campaign_uploading, …). */
  employee_type?: string | null
  /** normal | vip | vvip للعملاء فقط */
  customer_tier?: string | null
}

export type CustomerBalanceStatus = 'ok' | 'low' | 'critical'

export interface AppUser {
  id: number
  name: string
  email: string
  role: Role
  company: string
  balance: number
  lastLogin: string
  status: string
  employee_type?: string | null
  customer_tier?: string | null
  /** Present for customers when API returns wallet health (admin user list). */
  balance_status?: CustomerBalanceStatus
}

export interface Campaign {
  id: string
  name: string
  owner: string
  platform: 'Meta'
  status: CampaignStatus
  clicks: number
  spend: number
  createdAt: string
}

export interface Receipt {
  id: string
  user: string
  amount: number
  uploadedAt: string
  status: 'approved' | 'pending'
}

export interface NotificationItem {
  id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  createdAt: string
}
