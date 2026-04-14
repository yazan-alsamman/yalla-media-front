import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { campaigns, notifications as mockNotifications, receipts } from '../data/mockData'
import { api } from '../lib/api'
import { clearStoredToken, getStoredToken, setStoredToken } from '../lib/authToken'
import type { AppUser, AuthUser, Language, Role } from '../types'

const LANG_STORAGE_KEY = 'app-language'

/** Dashboard is Arabic-only; keep API/localStorage aligned without exposing EN in the UI. */
const UI_LANGUAGE: Language = 'ar'

type ThemeMode = 'light' | 'dark'

interface MeResponse {
  success?: boolean
  data?: { user: AuthUser }
}

interface LoginResponse {
  success?: boolean
  message?: string
  data?: { token: string; user: AuthUser }
}

function parseRole(value: string): Role {
  if (value === 'super_admin' || value === 'admin' || value === 'employee' || value === 'accountant' || value === 'customer') {
    return value
  }
  return 'customer'
}

function normalizeAuthUser(raw: AuthUser): AuthUser {
  return {
    ...raw,
    role: typeof raw.role === 'string' ? parseRole(raw.role) : raw.role,
    employee_type: raw.employee_type ?? null,
  }
}

interface AppContextValue {
  authReady: boolean
  isAuthenticated: boolean
  currentUser: AuthUser | null
  role: Role
  language: Language
  theme: ThemeMode
  users: AppUser[]
  campaigns: typeof campaigns
  receipts: typeof receipts
  notifications: typeof mockNotifications
  unreadNotificationCount: number
  pendingTaskInboxCount: number
  refreshInbox: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (input: {
    name: string
    email: string
    phone?: string
    password: string
    password_confirmation: string
  }) => Promise<void>
  logout: () => Promise<void>
  refreshCurrentUser: () => Promise<void>
  setLanguage: (language: Language) => void
  setTheme: (theme: ThemeMode) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem('app-theme')
  if (saved === 'light' || saved === 'dark') {
    return saved
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [pendingTaskInboxCount, setPendingTaskInboxCount] = useState(0)

  const setThemeWithStorage = useCallback((nextTheme: ThemeMode) => {
    setTheme(nextTheme)
    localStorage.setItem('app-theme', nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
  }, [])

  const setLanguageWithStorage = useCallback((_next: Language) => {
    localStorage.setItem(LANG_STORAGE_KEY, 'ar')
    if (getStoredToken()) {
      void api.put('/auth/profile', { language: 'ar' }).catch(() => {
        /* ignore */
      })
    }
  }, [])

  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setAuthReady(true)
      return
    }
    void (async () => {
      try {
        const res = (await api.get('/auth/me')) as MeResponse
        const user = res?.data?.user
        if (user) {
          setCurrentUser(normalizeAuthUser(user))
        } else {
          clearStoredToken()
        }
      } catch {
        clearStoredToken()
      } finally {
        setAuthReady(true)
      }
    })()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = (await api.post('/auth/login', {
      email,
      password,
      platform: 'web',
    })) as LoginResponse
    const token = res?.data?.token
    const user = res?.data?.user
    if (!token || !user) {
      throw new Error(res?.message || 'Login failed')
    }
    setStoredToken(token)
    const normalized = normalizeAuthUser(user)
    setCurrentUser(normalized)
    setLanguageWithStorage('ar')
  }, [setLanguageWithStorage])

  const register = useCallback(
    async (input: {
      name: string
      email: string
      phone?: string
      password: string
      password_confirmation: string
    }) => {
      const res = (await api.post('/auth/register', {
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone?.trim() || undefined,
        password: input.password,
        password_confirmation: input.password_confirmation,
        platform: 'web',
      })) as LoginResponse
      const token = res?.data?.token
      const user = res?.data?.user
      if (!token || !user) {
        throw new Error(res?.message || 'Registration failed')
      }
      setStoredToken(token)
      const normalized = normalizeAuthUser(user)
      setCurrentUser(normalized)
      setLanguageWithStorage('ar')
    },
    [setLanguageWithStorage],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* still clear locally */
    } finally {
      clearStoredToken()
      setCurrentUser(null)
      setUnreadNotificationCount(0)
      setPendingTaskInboxCount(0)
    }
  }, [])

  const refreshCurrentUser = useCallback(async () => {
    try {
      const res = (await api.get('/auth/me')) as MeResponse
      const user = res?.data?.user
      if (user) {
        setCurrentUser(normalizeAuthUser(user))
      }
    } catch {
      /* ignore */
    }
  }, [])

  const refreshInbox = useCallback(async () => {
    if (!getStoredToken() || !currentUser) {
      setUnreadNotificationCount(0)
      setPendingTaskInboxCount(0)
      return
    }
    try {
      const notifRes = (await api.get('/notifications', { params: { per_page: 50 } })) as {
        data?: { data?: { read?: boolean }[] }
      }
      const rows = notifRes?.data?.data
      const unread = Array.isArray(rows) ? rows.filter((n) => !n.read).length : 0
      setUnreadNotificationCount(unread)
    } catch {
      setUnreadNotificationCount(0)
    }

    try {
      const r = currentUser.role
      if (r === 'customer' || r === 'super_admin') {
        setPendingTaskInboxCount(0)
        return
      }
      const st = (await api.get('/tasks/stats')) as { data?: { open?: number } }
      setPendingTaskInboxCount(Number(st?.data?.open ?? 0))
    } catch {
      setPendingTaskInboxCount(0)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      setUnreadNotificationCount(0)
      setPendingTaskInboxCount(0)
      return
    }
    void refreshInbox()
    const t = window.setInterval(() => void refreshInbox(), 90_000)
    return () => window.clearInterval(t)
  }, [currentUser, refreshInbox])

  const value = useMemo<AppContextValue>(
    () => ({
      authReady,
      isAuthenticated: authReady && !!currentUser,
      currentUser,
      role: currentUser?.role ?? 'customer',
      language: UI_LANGUAGE,
      theme,
      users: [],
      campaigns,
      receipts,
      notifications: mockNotifications,
      unreadNotificationCount,
      pendingTaskInboxCount,
      refreshInbox,
      login,
      register,
      logout,
      refreshCurrentUser,
      setLanguage: setLanguageWithStorage,
      setTheme: setThemeWithStorage,
    }),
    [
      authReady,
      currentUser,
      theme,
      unreadNotificationCount,
      pendingTaskInboxCount,
      refreshInbox,
      login,
      register,
      logout,
      refreshCurrentUser,
      setThemeWithStorage,
      setLanguageWithStorage,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider')
  }
  return context
}
