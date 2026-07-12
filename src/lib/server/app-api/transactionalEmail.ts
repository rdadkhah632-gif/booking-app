import type { NextApiRequest } from "next";
import { getAppBaseUrl } from "@/lib/server/appBaseUrl";
import { bearerToken } from "@/lib/server/app-api/context";

export async function requestBookingStatusEmail(
  req: NextApiRequest,
  bookingId: string,
) {
  const appBaseUrl = getAppBaseUrl();
  const token = bearerToken(req);
  if (!appBaseUrl || !token) return "skipped";

  try {
    const response = await fetch(`${appBaseUrl}/api/email/transactional`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "booking_status_changed",
        bookingId,
      }),
    });
    return response.ok ? "requested" : "failed";
  } catch {
    return "failed";
  }
}
