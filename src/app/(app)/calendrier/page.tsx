import Link from "next/link";
import { addSession, deleteSession, updateSession } from "@/app/actions";
import { Hidden, PageHead } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { daysUntil, fmtDay, fmtLongDay, fmtRange, nowParis, relativeDay, sessionEnd, sessionStart, sessionWhen, todayParis } from "@/lib/format";
import type { Deadline, Session } from "@/lib/types";

export const metadata = { title: "Calendrier · AlgoLab hub" };

const KIND_LABEL: Record<Session["kind"], string> = { seance: "Séance", rdv: "Rendez-vous", autre: "Autre" };

type Ev = { key: string; day: string; title: string; details: string | null; type: "seance" | "rdv" | "autre" | "deadline"; start: string; end: string; range: string; session?: Session };

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function SessionForm({ s }: { s?: Session }) {
  const id = s?.id ?? "new";
  return (
    <form action={s ? updateSession : addSession} className="stack-form">
      {s && <Hidden name="id" value={s.id} />}
      <label htmlFor={`d-${id}`}>Date</label>
      <input id={`d-${id}`} name="day" type="date" defaultValue={s?.day} required />
      <label htmlFor={`t-${id}`}>Intitulé</label>
      <input id={`t-${id}`} name="title" defaultValue={s?.title} required />
      <label htmlFor={`k-${id}`}>Type</label>
      <select id={`k-${id}`} name="kind" defaultValue={s?.kind ?? "seance"}>
        <option value="seance">Séance</option>
        <option value="rdv">Rendez-vous</option>
        <option value="autre">Autre</option>
      </select>
      <div className="inline-form">
        <div className="field">
          <label htmlFor={`h1-${id}`}>De</label>
          <input id={`h1-${id}`} name="start_time" type="time" defaultValue={s?.start_time?.slice(0, 5) ?? ""} />
        </div>
        <div className="field">
          <label htmlFor={`h2-${id}`}>À</label>
          <input id={`h2-${id}`} name="end_time" type="time" defaultValue={s?.end_time?.slice(0, 5) ?? ""} />
        </div>
      </div>
      <label htmlFor={`x-${id}`}>Détails, lieu, à préparer (facultatif)</label>
      <input id={`x-${id}`} name="details" defaultValue={s?.details ?? ""} />
      <div className="form-actions">
        <button type="submit" className="btn primary">
          {s ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendrier">) {
  const { sb } = await requireMember();
  const params = await searchParams;
  const today = todayParis();
  const ym = typeof params.m === "string" && /^\d{4}-\d{2}$/.test(params.m) ? params.m : today.slice(0, 7);

  const [sessionsQ, deadlinesQ] = await Promise.all([sb.from("sessions").select("*").order("day"), sb.from("deadlines").select("*").order("due")]);
  const sessions = (sessionsQ.data ?? []) as Session[];
  const deadlines = (deadlinesQ.data ?? []) as Deadline[];

  const now = nowParis();
  const events: Ev[] = [
    ...sessions.map((s) => ({ key: s.id, day: s.day, title: s.title, details: s.details, type: s.kind, start: sessionStart(s), end: sessionEnd(s), range: fmtRange(s), session: s }) as Ev),
    ...deadlines.map((d) => ({ key: d.id, day: d.due, title: d.title, details: d.details, type: "deadline", start: `${d.due}T00:00`, end: `${d.due}T23:59`, range: "" }) as Ev),
  ].sort((a, b) => a.start.localeCompare(b.start));

  // Une séance terminée n'est plus « prochaine » : elle devient la dernière session.
  const real = sessions.filter((s) => s.kind !== "autre");
  const nextSession = real.find((s) => sessionEnd(s) >= now);
  const lastSession = [...real].reverse().find((s) => sessionEnd(s) < now);
  const ongoing = !!nextSession && sessionStart(nextSession) <= now;
  const nextDeadline = deadlines.find((d) => d.due >= today);

  // Grille du mois (semaines du lundi au dimanche)
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const byDay = new Map<string, Ev[]>();
  for (const e of events) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);

  const upcoming = events.filter((e) => e.end >= now);
  const past = events.filter((e) => e.end < now).reverse();

  return (
    <>
      <PageHead title="Calendrier" sub="Séances, rendez-vous et deadlines. Tout le monde peut ajouter ou modifier un événement." />

      <div className="banners three">
        <div className="banner">
          <span className="eyebrow">{ongoing ? "Session en cours" : "Prochaine session"}</span>
          {nextSession ? (
            <>
              <strong>{nextSession.title}</strong>
              <span>
                {sessionWhen(nextSession)} · {ongoing ? "maintenant" : relativeDay(nextSession.day)}
              </span>
              {nextSession.details && <span className="meta">{nextSession.details}</span>}
            </>
          ) : (
            <span className="muted">Aucune session à venir.</span>
          )}
        </div>
        <div className="banner past">
          <span className="eyebrow">Dernière session</span>
          {lastSession ? (
            <>
              <strong>{lastSession.title}</strong>
              <span>{sessionWhen(lastSession)}</span>
              {lastSession.details && <span className="meta">{lastSession.details}</span>}
            </>
          ) : (
            <span className="muted">Aucune session passée.</span>
          )}
        </div>
        <div className={`banner ${nextDeadline && daysUntil(nextDeadline.due) <= 3 ? "urgent" : ""}`}>
          <span className="eyebrow">Prochaine deadline</span>
          {nextDeadline ? (
            <>
              <strong>{nextDeadline.title}</strong>
              <span>
                {fmtLongDay(nextDeadline.due)} · {relativeDay(nextDeadline.due)}
              </span>
              {nextDeadline.details && <span className="meta">{nextDeadline.details}</span>}
            </>
          ) : (
            <span className="muted">
              Aucune deadline à venir. <Link href="/deadlines">En ajouter une</Link>
            </span>
          )}
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>
            {MONTHS[m - 1]} {y}
          </h2>
          <div className="month-nav">
            <Link className="btn small" href={`/calendrier?m=${shiftMonth(ym, -1)}`}>
              ← Précédent
            </Link>
            <Link className="btn small" href="/calendrier">
              Aujourd&apos;hui
            </Link>
            <Link className="btn small" href={`/calendrier?m=${shiftMonth(ym, 1)}`}>
              Suivant →
            </Link>
          </div>
        </div>
        <div className="cal" role="grid" aria-label={`${MONTHS[m - 1]} ${y}`}>
          {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => (
            <div key={d} className="cal-dow" role="columnheader">
              {d}
            </div>
          ))}
          {cells.map((day, i) => (
            <div key={i} role="gridcell" className={`cal-cell ${day ? "" : "empty"} ${day === today ? "today" : ""}`}>
              {day && (
                <>
                  <span className="cal-n">{Number(day.slice(8))}</span>
                  {(byDay.get(day) ?? []).map((e) => (
                    <span key={e.key} className={`ev ev-${e.type}`} title={[e.range, e.title].filter(Boolean).join(" ")}>
                      {e.range ? `${e.range.slice(0, 5)} ` : ""}
                      {e.title}
                    </span>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="legend">
          <span className="ev ev-seance">Séance</span>
          <span className="ev ev-rdv">Rendez-vous</span>
          <span className="ev ev-deadline">Deadline</span>
          <span className="ev ev-autre">Autre</span>
        </div>
      </section>

      <div className="two">
        <section className="card">
          <h2>À venir</h2>
          <ul className="timeline">
            {upcoming.map((e) => (
              <li key={e.key} className={e.start <= now ? "now" : ""}>
                <span className="d">
                  {fmtDay(e.day)}
                  {e.range && <small>{e.range}</small>}
                </span>
                <div className="row-main">
                  <span>
                    {e.title} <span className={`ev ev-${e.type}`}>{e.type === "deadline" ? "Deadline" : KIND_LABEL[e.type]}</span>
                  </span>
                  {e.details && <span className="meta">{e.details}</span>}
                  {e.session ? (
                    <details className="edit">
                      <summary>Modifier</summary>
                      <SessionForm s={e.session} />
                      <form action={deleteSession} className="danger-zone">
                        <Hidden name="id" value={e.session.id} />
                        <button type="submit" className="link-btn danger">
                          Supprimer cet événement
                        </button>
                      </form>
                    </details>
                  ) : (
                    <Link href="/deadlines" className="meta">
                      Voir dans Deadlines
                    </Link>
                  )}
                </div>
              </li>
            ))}
            {!upcoming.length && <li className="muted">Rien de prévu pour l&apos;instant.</li>}
          </ul>
          <details className="edit">
            <summary>Passé ({past.length})</summary>
            <ul className="timeline">
              {past.map((e) => (
                <li key={e.key} className="past">
                  <span className="d">
                    {fmtDay(e.day)}
                    {e.range && <small>{e.range}</small>}
                  </span>
                  <div className="row-main">
                    <span>{e.title}</span>
                    {e.details && <span className="meta">{e.details}</span>}
                    {e.session && (
                      <details className="edit">
                        <summary>Modifier</summary>
                        <SessionForm s={e.session} />
                        <form action={deleteSession} className="danger-zone">
                          <Hidden name="id" value={e.session.id} />
                          <button type="submit" className="link-btn danger">
                            Supprimer cet événement
                          </button>
                        </form>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section className="card">
          <h2>Ajouter un événement</h2>
          <SessionForm />
        </section>
      </div>
    </>
  );
}
