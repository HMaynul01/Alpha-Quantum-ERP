// src/lib/auth.ts — Alpha Quantum ERP v15
export type PermLevel =
  | 'none' | 'submit_only' | 'view_own' | 'view_all'
  | 'view_with_details' | 'report_view' | 'report_with_details' | 'full_control'

export interface UserPayload {
  id: string; username: string; email: string; full_name: string
  role: string; cube_id?: string | null; department?: string
  permissions: Record<string, string>
}

export function isCreator(user: UserPayload | null | undefined): boolean {
  return user?.role === 'creator'
}

export function isCubeAdmin(user: UserPayload | null | undefined): boolean {
  return ['creator','cube_admin'].includes(user?.role || '')
}

export function isSuperUser(user: UserPayload | null | undefined): boolean {
  return ['creator','cube_admin','superuser'].includes(user?.role || '')
}

export function getPermLevel(user: UserPayload | null | undefined, module: string): PermLevel {
  if (!user) return 'none'
  if (isSuperUser(user)) return 'full_control'
  return (user.permissions?.[module] as PermLevel | undefined) ?? 'none'
}

export function canView(user: UserPayload | null | undefined, module: string): boolean {
  const level = getPermLevel(user, module)
  return level !== 'none' && level !== 'submit_only'
}

export function canSubmit(user: UserPayload | null | undefined, module: string): boolean {
  if (isSuperUser(user)) return true
  return getPermLevel(user, module) !== 'none'
}

export function canFullControl(user: UserPayload | null | undefined, module: string): boolean {
  if (isSuperUser(user)) return true
  return getPermLevel(user, module) === 'full_control'
}
