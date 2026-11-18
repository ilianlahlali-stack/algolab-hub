import Link from "next/link";
import { PageHead } from "@/components/ui";
import { displayName, requireMember } from "@/lib/auth";
import { EXCLUDED_NAME } from "@/lib/exclude";
import { DRIVE_DOC_URL, dedupe, fmtDateTime, fmtShortDay } from "@/lib/format";
import type { Deadline, DriveFile, Doc, Note, Person, Session, Task } from "@/lib/types";

export const metadata = { title: "Recherche · AlgoLab hub" };

const MIME_LABEL: Record<string, string> = {
  "application/vnd.google-apps.document": "Google Doc",
  "application/vnd.google-apps.spreadsheet": "Google Sheet",
  "application/vnd.google-apps.presentation": "Google Slides",
  "application/vnd.google-apps.folder": "Dossier",
  "application/pdf": "PDF",
};

/** Retire les caractères qui ont un sens dans un filtre PostgREST ou dans un motif ILIKE. */
const clean = (q: string) => q.replace(/[%_,()*\\"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

export default async function SearchPage({ searchParams }: PageProps<"/recherche">) {
  const { sb } = await requireMember();
  const params = await searchParams;
  const raw = typeof params.q === "string" ? params.q : "";
  const q = clean(raw);

  if (!q) {
    return (
      <>
        <PageHead title="Recherche" sub="Tape un mot dans la barre en haut : documents, fichiers du Drive, personnes, dates, tâches." />
      </>
    );
  }
  const p = `%${q}%`;

  const [docsQ, filesQ, peopleQ, deadlinesQ, sessionsQ, tasksQ, wallQ] = await Promise.all([
    sb.from("documents").select("*").or(`title.ilike.${p},category.ilike.${p},summary.ilike.${p},body.ilike.${p}`).limit(30),
    sb.from("drive_files").select("id,name,mime_type,web_view_link,modified_time,last_modifying_user,trashed,parent_name").eq("trashed", false).ilike("name", p).order("modified_time", { ascending: false }).limit(40),
    sb.from("people").select("*").or(`name.ilike.${p},role.ilike.${p},email.ilike.${p},category.ilike.${p}`).limit(20),
    sb.from("deadlines").select("*").or(`title.ilike.${p},details.ilike.${p}`).limit(20),
    sb.from("sessions").select("*").or(`title.ilike.${p},details.ilike.${p}`).limit(20),
    sb.from("tasks").select("*").ilike("title", p).limit(20),
    sb.from("notes").select("*").ilike("body", p).order("created_at", { ascending: false }).limit(20),
  ]);

  const docs = (docsQ.data ?? []) as Doc[];
  const files = dedupe(((filesQ.data ?? []) as DriveFile[]).filter((f) => f.mime_type !== "application/vnd.google-apps.folder" && !EXCLUDED_NAME.test(f.name)));
  const people = (peopleQ.data ?? []) as Person[];
  const deadlines = (deadlinesQ.data ?? []) as Deadline[];
  const sessions = (sessionsQ.data ?? []) as Session[];
  const tasks = (tasksQ.data ?? []) as Task[];
  const wall = (wallQ.data ?? []) as Note[];
  const total = docs.length + files.length + people.length + deadlines.length + sessions.length + tasks.length + wall.length;

  return (
    <>
      <PageHead title={`Recherche : « ${q} »`} sub={`${total} résultat(s)`} />

      {docs.length > 0 && (
        <section className="card">
          <h2>Documents</h2>
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
                    <span className="meta">{[d.category, d.summary].filter(Boolean).join(" · ")}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {files.length > 0 && (
        <section className="card">
          <h2>Fichiers du Drive</h2>
          <ul className="rows">
            {files.map((f) => (
              <li key={f.id} className="row">
                <div className="row-main">
                  <a href={f.web_view_link ?? "#"} target="_blank" rel="noreferrer">
                    {f.name}
                  </a>
                  <span className="meta">
                    {[MIME_LABEL[f.mime_type ?? ""] ?? "Fichier", f.parent_name, f.modified_time ? fmtDateTime(f.modified_time) : null].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {people.length > 0 && (
        <section className="card">
          <h2>Personnes</h2>
          <ul className="rows">
            {people.map((x) => (
              <li key={x.id} className="row">
                <div className="row-main">
                  <Link href="/personnes">{x.name}</Link>
                  <span className="meta">{[x.category, x.role, x.email].filter(Boolean).join(" · ")}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(deadlines.length > 0 || sessions.length > 0 || tasks.length > 0) && (
        <section className="card">
          <h2>Dates et tâches</h2>
          <ul className="rows">
            {deadlines.map((d) => (
              <li key={d.id} className="row">
                <div className="row-main">
                  <Link href="/deadlines">{d.title}</Link>
                  <span className="meta">Deadline · {fmtShortDay(d.due)}</span>
                </div>
              </li>
            ))}
            {sessions.map((s) => (
              <li key={s.id} className="row">
                <div className="row-main">
                  <Link href="/calendrier">{s.title}</Link>
                  <span className="meta">Calendrier · {fmtShortDay(s.day)}</span>
                </div>
              </li>
            ))}
            {tasks.map((t) => (
              <li key={t.id} className="row">
                <div className="row-main">
                  <Link href="/deadlines">{t.title}</Link>
                  <span className="meta">Tâche{t.owner ? ` · ${t.owner}` : ""}{t.done ? " · faite" : ""}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {wall.length > 0 && (
        <section className="card">
          <h2>Mur</h2>
          <ul className="rows">
            {wall.map((n) => (
              <li key={n.id} className="row">
                <div className="row-main">
                  <Link href="/mur" className="clamp">
                    {n.body}
                  </Link>
                  <span className="meta">
                    {displayName(n.author)} · {fmtDateTime(n.created_at)}
                    {n.parent_id ? " · réponse" : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {total === 0 && <p className="muted">Rien trouvé. Essaie un autre mot, ou une partie du titre.</p>}
    </>
  );
}
