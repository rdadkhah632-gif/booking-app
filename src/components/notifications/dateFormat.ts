export function formatCustomerDateTime(value?: string | null) {
  if (!value) return "";

  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCustomerNotificationText(value?: string | null) {
  return (value || "").replace(/\b(\d{1,2}:\d{2}):\d{2}\b/g, "$1");
}
