import Link from "next/link";
import { addDriveFolder, syncDriveNow, toggleTask } from "@/app/actions";
import { Hidden, PageHead } from "@/components/ui";
import { displayName, requireMember } from "@/lib/auth";
import { DRIVE_DOC_URL, daysUntil, fmtDateTime, fmtLongDay, fmtShortDay, nowParis, relativeDay, sessionEnd, sessionStart, sessionWhen, todayParis } from "@/lib/format";
import type { Deadline, Doc, DriveEvent, DriveFolder, Note, Session, Task } from "@/lib/types";

export const maxDuration = 60;

const KIND: Record<DriveEvent["kind"], { label: string; cls: string }> = {
  added: { label: "Ajouté", cls: "ok" },
  modified: { label: "Modifié", cls: "info" },
  removed: { label: "Retiré", cls: "todo" },
};

export default async function Dashboard() {
  const { sb } = await requireMember();

  const [tasksQ, notesQ, sessionsQ, deadlinesQ, docsQ, eventsQ, foldersQ] = await Promise.all([
    sb.from("tasks").select("*").eq("done", false).order("due", { ascending: true, nullsFirst: false }).order("created_at"),
    sb.from("notes").select("*").order("created_at", { ascending: false }).limit(60),
    sb.from("sessions").select("*").order("day"),
    sb.from("deadlines").select("*").order("due"),
    sb.from("documents").select("*").order("updated_at", { ascending: false }).limit(6),
    sb.from("drive_events").select("*").order("created_at", { ascending: false }).limit(12),
    sb.from("drive_folders").select("*").order("label"),
  ]);

  const tasks = (tasksQ.data ?? []) as Task[];
  const wall = (notesQ.data ?? []) as Note[];
  const posts = wall.filter((n) => !n.parent_id);
  const replyCount = (id: string) => wall.filter((n) => n.parent_id === id).length;
  const sessions = (sessionsQ.data ?? []) as Session[];
  const deadlines = (deadlinesQ.data ?? []) as Deadline[];
  const docs = (docsQ.data ?? []) as Doc[];
  const events = (eventsQ.data ?? []) as DriveEvent[];
  const folders = (foldersQ.data ?? []) as DriveFolder[];

  const today = todayParis();
  const now = nowParis();
  const real = sessions.filter((s) => s.kind !== "autre");
  // Une séance terminée n'est plus « prochaine » : elle devient la dernière session.
  const nextSession = real.find((s) => sessionEnd(s) >= now);
  const lastSession = [...real].reverse().find((s) => sessionEnd(s) < now);
  const ongoing = !!nextSession && sessionStart(nextSession) <= now;
  const nextDeadline = deadlines.find((d) => d.due >= today);
  const lastSync = folders
    .map((f) => f.last_synced_at)
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return (
    <>
      <PageHead title="Tableau de bord" sub="Enquête sur VisuDSN, l'outil d'aide au ciblage des contrôles de l'Inspection du travail" />

      <div className="banners three">
        <Link href="/calendrier" className="banner">
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
        </Link>
        <Link href="/calendrier" className="banner past">
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
        </Link>
        <Link href="/deadlines" className={`banner ${nextDeadline && daysUntil(nextDeadline.due) <= 3 ? "urgent" : ""}`}>
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
            <span className="muted">Aucune deadline à venir.</span>
          )}
        </Link>
      </div>

      <div className="two">
        <section className="card">
          <div className="card-head">
            <h2>À faire</h2>
            <Link href="/deadlines" className="meta">
              {tasks.length} en cours · tout voir
            </Link>
          </div>
          <ul className="rows">
            {tasks.slice(0, 8).map((t) => (
              <li key={t.id} className="row">
                <form action={toggleTask}>
                  <Hidden name="id" value={t.id} />
                  <Hidden name="done" value="false" />
                  <button type="submit" className="check" aria-label="Marquer comme fait" />
                </form>
                <div className="row-main">
                  <span className="row-title">{t.title}</span>
                  <span className="meta">{[t.owner, t.due ? `pour le ${fmtShortDay(t.due)}` : null].filter(Boolean).join(" · ")}</span>
                </div>
              </li>
            ))}
            {!tasks.length && <li className="muted small">Tout est fait.</li>}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Documents récents</h2>
            <Link href="/documents" className="meta">
              Tous les documents
            </Link>
          </div>
          <ul className="rows">
            {docs.map((d) => {
              const url = d.kind === "gdoc" && d.drive_file_id ? DRIVE_DOC_URL(d.drive_file_id) : d.kind === "link" ? d.url : null;
              return (
                <li key={d.id} className="row">
                  <div className="row-main">
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer">
                        {d.title}
                      </a>
                    ) : (
                      <Link href={`/documents?cat=${encodeURIComponent(d.category)}`}>{d.title}</Link>
                    )}
                    <span className="meta">{d.category}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="two">
        <section className="card">
          <div className="card-head">
            <h2>Activité du Drive</h2>
            <form action={syncDriveNow}>
              <button type="submit" className="btn small">
                Synchroniser
              </button>
            </form>
          </div>
          <p className="meta">
            {lastSync ? `Dernière synchro : ${fmtDateTime(lastSync)} · automatique toutes les 15 min` : "Pas encore synchronisé."}
          </p>
          {events.length ? (
            <ul className="feed">
              {events.map((e) => (
                <li key={e.id}>
                  <span className={`pill ${KIND[e.kind].cls}`}>{KIND[e.kind].label}</span>
                  <div className="row-main">
                    {e.web_view_link && e.kind !== "removed" ? (
                      <a href={e.web_view_link} target="_blank" rel="noreferrer">
                        {e.name}
                      </a>
                    ) : (
                      <span>{e.name}</span>
                    )}
                    <span className="meta">
                      {[e.parent_name ?? e.folder_label, e.actor, e.happened_at ? fmtDateTime(e.happened_at) : null].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Les ajouts et modifications de fichiers apparaîtront ici.</p>
          )}
          <details className="edit">
            <summary>Dossiers surveillés ({folders.length})</summary>
            <ul className="plain small">
              {folders.map((f) => (
                <li key={f.id}>
                  <a href={`https://drive.google.com/drive/folders/${f.id}`} target="_blank" rel="noreferrer">
                    {f.label}
                  </a>
                </li>
              ))}
            </ul>
            <form action={addDriveFolder} className="stack-form">
              <label htmlFor="folder-url">Lien du dossier Drive</label>
              <input id="folder-url" name="folder" placeholder="https://drive.google.com/drive/folders/…" required />
              <label htmlFor="folder-label">Nom affiché</label>
              <input id="folder-label" name="label" required />
              <div className="form-actions">
                <button type="submit" className="btn">
                  Surveiller ce dossier
                </button>
              </div>
            </form>
          </details>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Le mur</h2>
            <Link href="/mur" className="meta">
              Publier ou répondre
            </Link>
          </div>
          <ul className="feed">
            {posts.slice(0, 5).map((n) => (
              <li key={n.id} className="note">
                <div className="row-main">
                  <span className="note-body clamp">{n.body}</span>
                  <span className="meta">
                    {displayName(n.author)} · {fmtDateTime(n.created_at)}
                    {replyCount(n.id) > 0 ? ` · ${replyCount(n.id)} réponse(s)` : ""}
                  </span>
                </div>
              </li>
            ))}
            {!posts.length && <li className="muted small">Rien pour l&apos;instant : lance la discussion sur le mur.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
