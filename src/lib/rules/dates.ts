const INDIA_TIME_ZONE = "Asia/Kolkata";

export function addHours(isoDate: string, hours: number): string {
  return new Date(new Date(isoDate).getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function addDays(isoDate: string, days: number): string {
  return addHours(isoDate, days * 24);
}

export function differenceInHours(later: string, earlier: string): number {
  return (new Date(later).getTime() - new Date(earlier).getTime()) / (60 * 60 * 1000);
}

export function formatIndiaDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: INDIA_TIME_ZONE,
  }).format(new Date(isoDate));
}

export function formatIndiaDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: INDIA_TIME_ZONE,
  }).format(new Date(isoDate));
}

export function formatRupees(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}
