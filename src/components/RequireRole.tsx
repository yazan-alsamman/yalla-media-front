import { Navigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import type { Role } from '../types'

type RequireRoleProps = {
  allow: Role[]
  /** When role is `employee`, also allow these `employee_type` values (Laravel). */
  orEmployeeTypes?: string[]
  children: React.ReactNode
}

export function RequireRole({ allow, orEmployeeTypes, children }: RequireRoleProps) {
  const { role, currentUser } = useAppContext()
  if (allow.includes(role)) {
    return <>{children}</>
  }
  const et = currentUser?.employee_type ?? ''
  if (role === 'employee' && orEmployeeTypes?.length && et && orEmployeeTypes.includes(et)) {
    return <>{children}</>
  }
  return <Navigate to="/dashboard" replace />
}
