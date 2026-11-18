import { PageHead } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { EXCLUDED_NAME } from "@/lib/exclude";
import { dedupe, fmtDateTime } from "@/lib/format";
import type { DriveEvent, DriveFile, Doc } from "@/lib/types";

export const metadata = { title: "Journal d'enquête · AlgoLab hub" };

const isJournal = (name: string) => /journal d.enqu[êe]te/i.test(name);
const isTemplate = (name: string) => /template/i.test(name);

export default async function JournalPage() {
  const { sb } = await requireMember();
  const [filesQ, eventsQ, docsQ] = await Promise.all([
    sb.from("drive_files").select("id,name,mime_type,web_view_link,modified_time,last_modifying_user,trashed,parent_name").eq("trashed", false).ilike("name", "%journal%"),
    sb.from("drive_events").select("*").ilike("name", "%journal%").order("created_at", { ascending: false }).limit(15),
    sb.from("documents").select("*").eq("category", "Journal d'enquête"),
  ]);

  const files = dedupe(((filesQ.data ?? []) as DriveFile[]).filter((f) => isJournal(f.name) && !EXCLUDED_NAME.test(f.name)));
  const journals = files.filter((f) => !isTemplate(f.name)).sort((a, b) => (b.modified_time ?? "").localeCompare(a.modified_time ?? ""));
  const templates = files.filter((f) => isTemplate(f.name));
  const events = ((eventsQ.data ?? []) as DriveEvent[]).filter((e) => isJournal(e.name));
  const extra = (docsQ.data ?? []) as Doc[];

  return (
    <>
      <PageHead
        title="Journal d'enquête"
        sub="Une entrée par semaine, rédigée dans le Google Doc du groupe. Ouvre-le dans le Drive pour écrire."
      />

      <section className="card">
        <h2>Nos journaux</h2>
        <ul className="docs">
          {journals.map((f) => (
            <li key={f.id} className="doc">
              <div className="doc-main">
                <div className="doc-title">
                  <a href={f.web_view_link ?? `https://docs.google.com/document/d/${f.id}/edit`} target="_blank" rel="noreferrer">
                    {f.name}
                  </a>
                  <span className="pill info">Google Doc</span>
                </div>
                <span className="meta">
                  {f.modified_time ? `Dernière modification le ${fmtDateTime(f.modified_time)}` : null}
                  {f.last_modifying_user ? ` par ${f.last_modifying_user}` : null}
                </span>
              </div>
              <div className="doc-actions">
                <a className="btn small primary" href={f.web_view_link ?? `https://docs.google.com/document/d/${f.id}/edit`} target="_blank" rel="noreferrer">
                  Ouvrir dans Drive
                </a>
              </div>
            </li>
          ))}
          {extra.map((d) => (
            <li key={d.id} className="doc">
              <div className="doc-main">
                <div className="doc-title">
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noreferrer">
                      {d.title}
                    </a>
                  ) : (
                    <span>{d.title}</span>
                  )}
                  <span className="pill">Lien</span>
                </div>
                {d.summary && <span className="meta">{d.summary}</span>}
              </div>
            </li>
          ))}
          {!journals.length && !extra.length && (
            <li className="muted">
              Aucun journal repéré dans les dossiers surveillés. Lance une synchro depuis le tableau de bord, ou ajoute un lien dans Documents
              (catégorie « Journal d&apos;enquête »).
            </li>
          )}
        </ul>
      </section>

      <div className="two">
        <section className="card">
          <h2>Activité récente</h2>
          <ul className="feed">
            {events.map((e) => (
              <li key={e.id}>
                <div className="row-main">
                  <a href={e.web_view_link ?? "#"} target="_blank" rel="noreferrer">
                    {e.name}
                  </a>
                  <span className="meta">
                    {[e.actor, e.happened_at ? fmtDateTime(e.happened_at) : null].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </li>
            ))}
            {!events.length && <li className="muted small">Les modifications du journal apparaîtront ici après la prochaine synchro.</li>}
          </ul>
        </section>

        <section className="card">
          <h2>Modèle d&apos;entrée</h2>
          <p className="muted small">
            Une entrée par séance : activités menées, résumé, analyse (nouvelles informations, questions en suspens, angles, désaccords),
            prochaines étapes et besoins.
          </p>
          <ul className="plain">
            {templates.map((f) => (
              <li key={f.id}>
                <a href={f.web_view_link ?? `https://docs.google.com/document/d/${f.id}/edit`} target="_blank" rel="noreferrer">
                  {f.name}
                </a>
              </li>
            ))}
            {!templates.length && <li className="muted small">Le template apparaît ici quand le dossier « Boîte à outils » est synchronisé.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
