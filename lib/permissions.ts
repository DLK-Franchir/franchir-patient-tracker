export type Role = 'marcel' | 'franchir' | 'gilles' | 'admin'

export type Permission =
  | 'CREATE_PATIENT'
  | 'VALIDATE_MEDICAL'
  | 'EDIT_QUOTE'
  | 'SCHEDULE_SURGERY'
  | 'VIEW_ALL'
  | 'ADMIN'

export const rolePermissions: Record<Role, Permission[]> = {
  marcel: [
    'CREATE_PATIENT',
    'EDIT_QUOTE',
    'SCHEDULE_SURGERY',
    'VIEW_ALL',
  ],
  franchir: [
    'CREATE_PATIENT',
    'EDIT_QUOTE',
    'SCHEDULE_SURGERY',
    'VIEW_ALL',
  ],
  gilles: [
    'VALIDATE_MEDICAL',
    'VIEW_ALL',
  ],
  admin: [
    'CREATE_PATIENT',
    'VALIDATE_MEDICAL',
    'EDIT_QUOTE',
    'SCHEDULE_SURGERY',
    'VIEW_ALL',
    'ADMIN',
  ],
}

export function can(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}
