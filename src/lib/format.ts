const TZ = "Europe/Paris";

/** « 2026-11-18 » -> « mer. 18/11 » */
export const fmtDay = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

/** « 2026-11-18 » -> « 18/11 » */
export const fmtShortDay = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** « 2026-11-18 » -> « mercredi 18 novembre » */
export const fmtLongDay = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );

export const fmtDateTime = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(
    new Date(d),
  );

export const todayParis = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

/** Nombre de jours entre aujourd'hui et une date « AAAA-MM-JJ » (négatif si passée). */
export function daysUntil(day: string): number {
  const a = new Date(`${todayParis()}T00:00:00Z`).getTime();
  const b = new Date(`${day}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function relativeDay(day: string): string {
  const n = daysUntil(day);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
}

export const DRIVE_DOC_URL = (id: string) => `https://docs.google.com/document/d/${id}/edit`;

/** Garde la première occurrence de chaque id (un fichier du Drive peut figurer sous plusieurs dossiers surveillés). */
export function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/** Date et heure à Paris, « AAAA-MM-JJTHH:MM » (comparable comme du texte). */
export function nowParis(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date())
    .replace(" ", "T");
}

type Timed = { day: string; start_time: string | null; end_time: string | null };

/** « 12:30:00 » -> « 12h30 » */
export const fmtHour = (t: string | null) => (t ? t.slice(0, 5).replace(":", "h") : "");

/** « 12h30 – 14h30 », « 12h30 » ou chaîne vide. */
export function fmtRange(s: Pick<Timed, "start_time" | "end_time">): string {
  if (!s.start_time) return "";
  return s.end_time ? `${fmtHour(s.start_time)} – ${fmtHour(s.end_time)}` : fmtHour(s.start_time);
}

/** Fin d'une séance, « AAAA-MM-JJTHH:MM » : sans horaire, elle dure toute la journée. */
export const sessionEnd = (s: Timed) => `${s.day}T${(s.end_time ?? s.start_time ?? "23:59").slice(0, 5)}`;
export const sessionStart = (s: Timed) => `${s.day}T${(s.start_time ?? "00:00").slice(0, 5)}`;

/** « mercredi 18 novembre · 12h30 – 14h30 » */
export const sessionWhen = (s: Timed & { day: string }) => [fmtLongDay(s.day), fmtRange(s)].filter(Boolean).join(" · ");
