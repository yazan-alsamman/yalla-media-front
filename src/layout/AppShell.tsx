import {
  Activity,
  Bell,
  Briefcase,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardList,
  FileText,
  LogOut,
  LayoutDashboard,
  LineChart,
  Megaphone,
  MonitorSmartphone,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Plug,
  Radar,
  Smartphone,
  Settings,
  SlidersHorizontal,
  Sun,
  UserCircle2,
  UserPlus,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { getNavKeys } from '../lib/staffConfig'
import { publicUrl } from '../lib/publicUrl'
import { roleLabel, t } from '../i18n'

const links = [
  { key: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'admin_pulse', to: '/operations-pulse', label: 'Operations pulse', icon: Activity },
  { key: 'users', to: '/users', label: 'Users', icon: Users },
  { key: 'account_requests', to: '/account-requests', label: 'Account requests', icon: UserPlus },
  { key: 'campaigns', to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { key: 'campaign_tracking', to: '/campaign-tracking', label: 'Campaign tracking', icon: Radar },
  { key: 'ad_accounts', to: '/ad-accounts', label: 'Ad accounts', icon: MonitorSmartphone },
  { key: 'integrations', to: '/integrations', label: 'Integrations', icon: Plug },
  { key: 'workspace', to: '/workspace', label: 'Workspace', icon: Briefcase },
  { key: 'top_up_methods', to: '/top-up-methods', label: 'Top-up methods', icon: Smartphone },
  { key: 'billing', to: '/billing', label: 'Billing', icon: CircleDollarSign },
  { key: 'bills', to: '/bills', label: 'Bills', icon: FileText },
  { key: 'tasks', to: '/tasks', label: 'Tasks', icon: ClipboardList },
  { key: 'campaign_types', to: '/campaign-types', label: 'Campaign types', icon: SlidersHorizontal },
  { key: 'reports', to: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
  { key: 'daily_report', to: '/daily-report', label: 'Daily report', icon: LineChart },
  { key: 'notifications', to: '/notifications', label: 'Notifications', icon: Bell },
  { key: 'settings', to: '/settings', label: 'Settings', icon: Settings },
]

const navGroups: { labelKey: string; keys: string[] }[] = [
  { labelKey: 'navGroups.overview', keys: ['dashboard'] },
  { labelKey: 'navGroups.clients', keys: ['users', 'account_requests', 'tasks'] },
  { labelKey: 'navGroups.operations', keys: ['campaigns', 'campaign_tracking', 'ad_accounts', 'integrations', 'campaign_types'] },
  { labelKey: 'navGroups.finance', keys: ['billing', 'bills', 'workspace', 'top_up_methods'] },
  { labelKey: 'navGroups.insights', keys: ['reports', 'daily_report'] },
  { labelKey: 'navGroups.administration', keys: ['admin_pulse'] },
  { labelKey: 'navGroups.account', keys: ['notifications', 'settings'] },
]

export function AppShell() {
  const { role, theme, setTheme, unreadNotificationCount, pendingTaskInboxCount, logout, language, currentUser } = useAppContext()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const allowed = getNavKeys(role, currentUser?.employee_type)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 1024) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  return (
    <div className="app-shell app-shell--rtl">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="brand">
          <img src={publicUrl('logo.png')} alt="" className="brand__logo" width={44} height={44} />
          <div>
            <strong className="brand__name">{t(language, 'brand.name')}</strong>
            <small className="brand__tagline">{t(language, 'topbar.dashboard')}</small>
          </div>
        </div>

        <nav id="sidebar-nav" className="sidebar__nav" aria-label="Main">
          {navGroups.map((group) => {
            const items = links.filter((item) => group.keys.includes(item.key) && allowed.includes(item.key))
            if (items.length === 0) return null
            return (
              <div key={group.labelKey}>
                <div className="nav-group__label">{t(language, group.labelKey)}</div>
                {items.map(({ key, to, label, icon: Icon }) => (
                  <NavLink key={key} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                    <Icon size={18} aria-hidden />
                    <span>{t(language, `nav.${key}`) || label}</span>
                    {key === 'tasks' &&
                    pendingTaskInboxCount > 0 &&
                    (role === 'employee' || role === 'accountant' || role === 'admin' || role === 'super_admin') ? (
                      <span className="nav-link__badge" aria-label={t(language, 'tasks.inboxBadge')}>
                        {pendingTaskInboxCount > 9 ? '9+' : pendingTaskInboxCount}
                      </span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>
      </aside>
      <button
        type="button"
        className={`sidebar-backdrop ${sidebarOpen ? 'sidebar-backdrop--open' : ''}`}
        aria-label={language === 'ar' ? 'إغلاق الشريط الجانبي' : 'Close sidebar'}
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />

      <main className="content-area">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn icon-btn--plain mobile-sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? (language === 'ar' ? 'إغلاق القائمة' : 'Close menu') : language === 'ar' ? 'فتح القائمة' : 'Open menu'}
            aria-expanded={sidebarOpen}
            aria-controls="sidebar-nav"
          >
            {sidebarOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </button>
          <div className="topbar__controls topbar__controls--right">
            <NavLink
              to="/notifications"
              className={({ isActive }) => `icon-btn icon-btn--plain ${isActive ? 'icon-btn--active' : ''}`}
              aria-label={t(language, 'nav.notifications')}
              title={t(language, 'nav.notifications')}
            >
              <Bell size={17} />
              {unreadNotificationCount > 0 ? <span className="nav-link__badge nav-link__badge--topbar" aria-hidden /> : null}
            </NavLink>

            <div className="profile-chip">
              <UserCircle2 size={18} className="profile-chip__avatar" aria-hidden />
              <div className="profile-chip__meta">
                <strong className="profile-chip__name">{currentUser?.name || t(language, 'common.profileName')}</strong>
                <small className="profile-chip__role">{roleLabel('ar', role, currentUser?.employee_type)}</small>
              </div>
              <button
                type="button"
                className="theme-pill"
                title={theme === 'dark' ? t(language, 'common.light') : t(language, 'common.dark')}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>

            <button
              type="button"
              className="icon-btn icon-btn--plain"
              onClick={logout}
              aria-label={t(language, 'topbar.logout')}
              title={t(language, 'topbar.logout')}
            >
              <LogOut size={16} />
            </button>
          </div>
          {role === 'super_admin' && allowed.includes('daily_report') ? (
            <NavLink
              to="/daily-report"
              className={({ isActive }) => `topbar-daily-shortcut ${isActive ? 'topbar-daily-shortcut--active' : ''}`}
              title={t(language, 'topbar.dailyReportShortcut')}
              aria-label={t(language, 'topbar.dailyReportShortcut')}
            >
              <LineChart size={18} aria-hidden />
              <span className="topbar-daily-shortcut__text">{t(language, 'topbar.dailyReportShortcut')}</span>
            </NavLink>
          ) : null}
        </header>

        <Outlet />
      </main>
    </div>
  )
}
