export type Role = 'customer' | 'business' | 'staff' | 'admin' | null

export type NavProps = {
  notificationCount: number
  primaryBusinessId: string | null
  onLogout: () => void
}

export function notificationLabel(role: Role, notificationCount: number) {
  if (role === 'admin') {
    if (notificationCount <= 0) return 'Operator notices'
    return `Operator notices (${notificationCount})`
  }

  if (role === 'business') {
    if (notificationCount <= 0) return 'Needs action'
    return `Needs action (${notificationCount})`
  }

  if (role === 'staff') {
    return 'Updates'
  }

  if (notificationCount <= 0) return 'Notifications'
  return `Notifications (${notificationCount})`
}