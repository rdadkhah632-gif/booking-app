type PublicStaffDisplay = {
  name?: string | null;
};

function looksGeneratedStaffName(name?: string | null) {
  const value = name?.trim();
  if (!value) return true;

  const lower = value.toLowerCase();
  const uuidPattern =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  return (
    lower.startsWith("live-business-") ||
    lower.startsWith("business-") ||
    lower.startsWith("staff-") ||
    uuidPattern.test(value)
  );
}

export function publicStaffName(
  staff: PublicStaffDisplay | null | undefined,
  fallback: string,
) {
  return looksGeneratedStaffName(staff?.name) ? fallback : staff!.name!.trim();
}

export function publicStaffInitial(
  staff: PublicStaffDisplay | null | undefined,
  fallback = "S",
) {
  const name = publicStaffName(staff, "");
  return name ? name.slice(0, 1).toUpperCase() : fallback;
}
