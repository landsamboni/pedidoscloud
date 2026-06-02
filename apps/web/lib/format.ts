export const APP_TIME_ZONE = "America/Bogota";

export function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dateKeyToUtcDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function formatMoney(value: number | string) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatTime(value: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: APP_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

export function formatOrderNumber(value: number) {
  return `#${String(value).padStart(3, "0")}`;
}

export function dateKeyDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateKey(d);
}

export function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${year}-${month}-${day}T12:00:00.000Z`));
}

