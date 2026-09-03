export type PreparedServiceDraft = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  durationMinutes: number;
  price: number;
  priceKnown: boolean;
  bookingType: "appointment" | "group";
  groupCapacity: number | null;
  privateBookingEnabled: boolean;
  privatePrice: number | null;
};

export type PreparedBusinessProfile = {
  name: string;
  description: string;
  imageUrl: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  category: string;
  timezone: string;
  currency: "ALL" | "EUR" | "GBP" | "USD";
  ownerTakesBookings: boolean;
};

export type PreparedProfileDraft = {
  caseId: string;
  profile: PreparedBusinessProfile;
  services: PreparedServiceDraft[];
  intendedOwnerEmail?: string | null;
  handoffIssuedAt?: string | null;
  handoffExpiresAt?: string | null;
  adoptedAt?: string | null;
  adoptedBusinessId?: string | null;
};

export const EMPTY_PREPARED_PROFILE: PreparedBusinessProfile = {
  name: "",
  description: "",
  imageUrl: "",
  phone: "",
  address: "",
  city: "",
  country: "Albania",
  category: "",
  timezone: "Europe/Tirane",
  currency: "ALL",
  ownerTakesBookings: false,
};

export function newPreparedService(): PreparedServiceDraft {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `service-${Date.now()}`,
    name: "",
    description: "",
    imageUrl: "",
    durationMinutes: 30,
    price: 0,
    priceKnown: false,
    bookingType: "appointment",
    groupCapacity: null,
    privateBookingEnabled: false,
    privatePrice: null,
  };
}
