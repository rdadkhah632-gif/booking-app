export type Role = "customer" | "business" | "staff" | "admin" | null;

export type NavProps = {
  notificationCount: number;
  primaryBusinessId: string | null;
  onLogout: () => void;
  t?: (key: string, fallback?: string) => string;
};

export function notificationLabel(
  role: Role,
  notificationCount: number,
  t: (key: string, fallback?: string) => string,
) {
  if (role === "admin") {
    const label = t("nav.operatorNotices", "Operator notices");
    if (notificationCount <= 0) return label;
    return `${label} (${notificationCount})`;
  }

  if (role === "business") {
    const label = t("nav.needsAction", "Needs action");
    if (notificationCount <= 0) return label;
    return `${label} (${notificationCount})`;
  }

  if (role === "staff") {
    const label = t("nav.updates", "Updates");
    if (notificationCount <= 0) return label;
    return `${label} (${notificationCount})`;
  }

  const label = t("nav.notifications", "Notifications");
  if (notificationCount <= 0) return label;
  return `${label} (${notificationCount})`;
}
