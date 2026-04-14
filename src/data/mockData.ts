import type { AppUser, Campaign, NotificationItem, Receipt, Role } from '../types'

export const roleLabels: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  employee: 'Employee',
  accountant: 'Accountant',
  customer: 'Customer',
}

export const users: AppUser[] = [
  {
    id: 1001,
    name: 'Ahmed Hassan',
    email: 'ahmed@yallamedia.com',
    role: 'super_admin',
    company: 'Yalla Media',
    balance: 62450,
    lastLogin: '2 min ago',
    status: 'active',
  },
  {
    id: 1002,
    name: 'Sara Omar',
    email: 'sara@orbitads.co',
    role: 'admin',
    company: 'Orbit Ads',
    balance: 18700,
    lastLogin: '15 min ago',
    status: 'active',
  },
  {
    id: 1003,
    name: 'Mohamed Tarek',
    email: 'm.tarek@trendup.io',
    role: 'employee',
    company: 'TrendUp',
    balance: 6200,
    lastLogin: '1 day ago',
    status: 'active',
  },
  {
    id: 1004,
    name: 'Nour Ali',
    email: 'nour@northdigital.net',
    role: 'accountant',
    company: 'North Digital',
    balance: 0,
    lastLogin: '17 days ago',
    status: 'dormant',
  },
]

export const campaigns: Campaign[] = [
  {
    id: 'C-301',
    name: 'Ramadan Lead Boost',
    owner: 'Orbit Ads',
    platform: 'Meta',
    status: 'active',
    clicks: 18230,
    spend: 6300,
    createdAt: '2026-03-12',
  },
  {
    id: 'C-302',
    name: 'Eid Sales Retargeting',
    owner: 'TrendUp',
    platform: 'Meta',
    status: 'pending',
    clicks: 0,
    spend: 0,
    createdAt: '2026-04-03',
  },
  {
    id: 'C-303',
    name: 'Always On Awareness',
    owner: 'North Digital',
    platform: 'Meta',
    status: 'rejected',
    clicks: 932,
    spend: 420,
    createdAt: '2026-02-11',
  },
  {
    id: 'C-304',
    name: 'Catalog Conversion Push',
    owner: 'Yalla Media',
    platform: 'Meta',
    status: 'active',
    clicks: 26340,
    spend: 12150,
    createdAt: '2026-03-01',
  },
]

export const receipts: Receipt[] = [
  { id: 'R-801', user: 'Orbit Ads', amount: 3500, uploadedAt: '2026-04-01', status: 'approved' },
  { id: 'R-802', user: 'TrendUp', amount: 1800, uploadedAt: '2026-04-02', status: 'pending' },
  { id: 'R-803', user: 'North Digital', amount: 5000, uploadedAt: '2026-04-04', status: 'pending' },
]

export const notifications: NotificationItem[] = [
  {
    id: 'N-1',
    title: 'Receipt approval required',
    message: 'Two new receipts are waiting for Super Admin approval.',
    severity: 'warning',
    createdAt: '5 min ago',
  },
  {
    id: 'N-2',
    title: 'Dormant account alert',
    message: 'North Digital has not logged in for more than 14 days.',
    severity: 'info',
    createdAt: '1 hour ago',
  },
  {
    id: 'N-3',
    title: 'Low balance account',
    message: '3 accounts are near zero balance. Top-up suggested.',
    severity: 'critical',
    createdAt: '3 hours ago',
  },
]

export const monthlySpending = [4200, 4900, 5400, 6100, 7300, 6900, 7800, 9100, 8600, 9900, 11300, 12400]

export const activityLog = [
  { time: '09:12', action: 'Top-up credit', actor: 'Sara Omar', amount: 3500 },
  { time: '10:03', action: 'Campaign accepted', actor: 'Mohamed Tarek', amount: 0 },
  { time: '11:45', action: 'Balance adjustment', actor: 'Ahmed Hassan', amount: 2000 },
  { time: '12:24', action: 'Receipt uploaded', actor: 'Nour Ali', amount: 1800 },
]
