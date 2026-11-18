import Link from "next/link";
import { addDocument, deleteDocument, moveToDrive, saveDocument, setFileCategory } from "@/app/actions";
import { CollapseAll } from "@/components/collapse-all";
import { UploadForm } from "@/components/upload-form";
import { Hidden, PageHead } from "@/components/ui";
import { displayName, requireMember } from "@/lib/auth";
import { EXPORT_FORMATS } from "@/lib/drive-docs";
import { DRIVE_DOC_URL, fmtDateTime } from "@/lib/format";
import { Markdown } from "@/lib/markdown";
import { driveItems, type DriveItem } from "@/lib/drive-catalog";
import { EXCLUDED_NAME } from "@/lib/exclude";
import type { Doc, DriveFile } from "@/lib/types";

const CATEGORY_ORDER = [
  "Lectures",
  "Matériel brut",
  "Cours",
  "Informations",
  "Notes et comptes rendus",
  "Livrables",
  "Outils",
  "Journal d'enquête",
];

const QUICK_ACCESS = "Dossiers du Drive";

const KIND_LABEL: Record<Doc["kind"], { label: string; cls: string }> = {
  gdoc: { label: "Google Doc", cls: "info" },
  note: { label: "Dans l'app", cls: "" },
  link: { label: "Lien", cls: "" },
};

const rank = (c: string) => {
  const i = CATEGORY_ORDER.indexOf(c);
  return i === -1 ? CATEGORY_ORDER.length : i;
};

export const metadata = { title: "Documents · AlgoLab hub" };

function DownloadForm({ doc }: { doc: Doc }) {
  if (doc.kind === "link") return null;
  const formats = doc.kind === "gdoc" ? Object.entries(EXPORT_FORMATS) : [["md", EXPORT_FORMATS.md], ["txt", EXPORT_FORMATS.txt], ["html", EXPORT_FORMATS.html]] as const;
  return (
    <form action={`/api/documents/${doc.id}/export`} method="get" className="download">
      <label htmlFor={`fmt-${doc.id}`} className="sr-only">
        Format de téléchargement
      </label>
      <select id={`fmt-${doc.id}`} name="format" defaultValue={doc.kind === "gdoc" ? "pdf" : "md"}>
        {formats.map(([key, f]) => (
          <option key={key} value={key}>
            {f.label}
          </option>
        ))}
      </select>
      <button type="submit" className="btn small">
        Télécharger
      </button>
    </form>
  );
}

function DriveRow({ item }: { item: DriveItem }) {
  return (
    <li className="doc">
      <div className="doc-main">
        <div className="doc-title">
          <a href={item.url} target="_blank" rel="noreferrer">
            {item.title}
          </a>
          <span className="pill">{item.typeLabel}</span>
          {item.overridden && <span className="pill info">Catégorie choisie</span>}
        </div>
        <span className="meta">
          {[item.modified ? `Modifié le ${fmtDateTime(item.modified)}` : null, item.modifiedBy].filter(Boolean).join(" par ")}
        </span>
      </div>
      <div className="doc-actions">
        <a className="btn small" href={item.url} target="_blank" rel="noreferrer">
          Ouvrir dans Drive
        </a>
      </div>
      <details className="edit doc-edit">
        <summary>Changer de catégorie</summary>
        <form action={setFileCategory} className="inline-form">
          <Hidden name="file_id" value={item.id} />
          <label htmlFor={`fc-${item.id}`} className="sr-only">
            Catégorie
          </label>
          <input id={`fc-${item.id}`} name="category" list="doc-categories" defaultValue={item.category} required />
          <button type="submit" className="btn small primary">
            Ranger ici
          </button>
        </form>
        {item.overridden && (
          <form action={setFileCategory}>
            <Hidden name="file_id" value={item.id} />
            <Hidden name="category" value="" />
            <button type="submit" className="link-btn">
              Revenir au classement automatique
            </button>
          </form>
        )}
      </details>
    </li>
  );
}

function DocCard({ doc }: { doc: Doc }) {
  const k = KIND_LABEL[doc.kind];
  const driveUrl = doc.kind === "gdoc" && doc.drive_file_id ? DRIVE_DOC_URL(doc.drive_file_id) : null;
  const openUrl = driveUrl ?? (doc.kind === "link" ? doc.url : null);
  return (
    <li className="doc">
      <div className="doc-main">
        <div className="doc-title">
          {openUrl ? (
            <a href={openUrl} target="_blank" rel="noreferrer">
              {doc.title}
            </a>
          ) : (
            <span>{doc.title}</span>
          )}
          <span className={`pill ${k.cls}`}>{k.label}</span>
        </div>
        {doc.summary && <span className="meta">{doc.summary}</span>}
        <span className="meta">
          {doc.kind !== "link" && doc.updated_by ? `Modifié par ${displayName(doc.updated_by)} le ${fmtDateTime(doc.updated_at)}` : null}
        </span>
        {doc.drive_error && <span className="alert small">Pas encore envoyé vers le Drive : {doc.drive_error}</span>}
      </div>
      <div className="doc-actions">
        {openUrl && (
          <a className="btn small" href={openUrl} target="_blank" rel="noreferrer">
            {doc.kind === "gdoc" ? "Ouvrir dans Drive" : "Ouvrir"}
          </a>
        )}
        <DownloadForm doc={doc} />
      </div>
      <details className="edit doc-edit">
        <summary>{doc.kind === "link" ? "Modifier" : "Aperçu et modification"}</summary>
        {doc.kind !== "link" && doc.body && <Markdown source={doc.body} />}
        <form action={saveDocument} className="stack-form">
          <Hidden name="id" value={doc.id} />
          <label htmlFor={`t-${doc.id}`}>Titre</label>
          <input id={`t-${doc.id}`} name="title" defaultValue={doc.title} required />
          <label htmlFor={`c-${doc.id}`}>Catégorie</label>
          <input id={`c-${doc.id}`} name="category" defaultValue={doc.category} list="doc-categories" />
          <label htmlFor={`s-${doc.id}`}>Description (facultatif)</label>
          <input id={`s-${doc.id}`} name="summary" defaultValue={doc.summary ?? ""} />
          {doc.kind === "link" ? (
            <>
              <label htmlFor={`u-${doc.id}`}>Adresse</label>
              <input id={`u-${doc.id}`} name="url" type="url" defaultValue={doc.url ?? ""} required />
            </>
          ) : (
            <>
              <label htmlFor={`b-${doc.id}`}>
                Contenu <span className="meta">(« ## » titre, « - » liste, **gras**, [texte](lien))</span>
              </label>
              <textarea id={`b-${doc.id}`} name="body" defaultValue={doc.body} rows={10} />
            </>
          )}
          <div className="form-actions">
            <button type="submit" className="btn primary">
              Enregistrer
            </button>
          </div>
        </form>
        {doc.kind === "gdoc" && (
          <p className="meta">Le texte du Google Doc est aussi modifiable dans le Drive : la synchro le recopie ici toutes les 15 minutes.</p>
        )}
        {doc.kind === "note" && (
          <form action={moveToDrive}>
            <Hidden name="id" value={doc.id} />
            <button type="submit" className="link-btn">
              Envoyer vers le Drive (créer un Google Doc)
            </button>
          </form>
        )}
        <form action={deleteDocument} className="danger-zone">
          <Hidden name="id" value={doc.id} />
          <button type="submit" className="link-btn danger">
            Supprimer ce document
          </button>
        </form>
        {doc.kind === "gdoc" && <p className="meta">Supprimer le document ne supprime pas son Google Doc dans le Drive.</p>}
      </details>
    </li>
  );
}

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const { sb } = await requireMember();
  const params = await searchParams;
  const cat = typeof params.cat === "string" ? params.cat : "";

  const [{ data }, { data: filesData }, { data: overrideData }] = await Promise.all([
    sb.from("documents").select("*").order("position").order("title"),
    sb.from("drive_files").select("id,name,mime_type,parent_name,web_view_link,modified_time,last_modifying_user,trashed").eq("trashed", false).limit(2000),
    sb.from("file_categories").select("file_id,category"),
  ]);
  const all = (data ?? []) as Doc[];
  const folders = all.filter((d) => d.category === QUICK_ACCESS);
  const docs = all.filter((d) => d.category !== QUICK_ACCESS);

  const overrides = new Map(((overrideData ?? []) as { file_id: string; category: string }[]).map((o) => [o.file_id, o.category]));
  const files = (filesData ?? []) as DriveFile[];
  const items = driveItems(files, all, overrides);

  // Dossiers du Drive où l'on peut publier un fichier (sans doublon, sans les éléments exclus)
  const seenFolder = new Set<string>();
  const folders2 = files
    .filter((f) => f.mime_type === "application/vnd.google-apps.folder" && !EXCLUDED_NAME.test(f.name) && !EXCLUDED_NAME.test(f.parent_name ?? ""))
    .filter((f) => (seenFolder.has(f.id) ? false : (seenFolder.add(f.id), true)))
    .map((f) => ({ id: f.id, label: f.parent_name ? `${f.name} (dans ${f.parent_name})` : f.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  const defaultFolder = process.env.DRIVE_DOCS_FOLDER_ID || process.env.DRIVE_FICHES_FOLDER_ID || "";
  if (defaultFolder && !seenFolder.has(defaultFolder)) folders2.unshift({ id: defaultFolder, label: "Ministères Sociaux (dossier du groupe)" });
  const grouped = new Map<string, Doc[]>();
  for (const d of docs) grouped.set(d.category, [...(grouped.get(d.category) ?? []), d]);
  const itemsBy = new Map<string, DriveItem[]>();
  for (const i of items) itemsBy.set(i.category, [...(itemsBy.get(i.category) ?? []), i]);
  const count = (c: string) => (grouped.get(c)?.length ?? 0) + (itemsBy.get(c)?.length ?? 0);
  const categories = [...new Set([...grouped.keys(), ...itemsBy.keys()])].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "fr"));
  const shown = cat ? categories.filter((c) => c === cat) : categories;
  const allCategories = [...new Set([...CATEGORY_ORDER, ...categories])];

  return (
    <>
      <PageHead title="Documents" sub="Lectures, matériel brut, informations… Le gros de la rédaction se fait dans le Drive : ouvre le Google Doc à côté.">
        <CollapseAll />
      </PageHead>

      <div className="docs-layout">
        <aside className="cats" aria-label="Catégories">
          <Link href="/documents" className={`cat ${cat ? "" : "on"}`}>
            <span>Tous les documents</span>
            <span className="count">{docs.length + items.length}</span>
          </Link>
          {categories.map((c) => (
            <Link key={c} href={`/documents?cat=${encodeURIComponent(c)}`} className={`cat ${cat === c ? "on" : ""}`}>
              <span>{c}</span>
              <span className="count">{count(c)}</span>
            </Link>
          ))}
          {folders.length > 0 && (
            <>
              <h3>Dossiers du Drive</h3>
              {folders.map((f) => (
                <a key={f.id} href={f.url ?? "#"} target="_blank" rel="noreferrer" className="cat folder" title={f.summary ?? undefined}>
                  <span>▸ {f.title}</span>
                </a>
              ))}
            </>
          )}
        </aside>

        <div className="docs-main">
      <details className="card add-card">
        <summary>Ajouter un fichier depuis mon ordinateur</summary>
        <UploadForm categories={allCategories} folders={folders2} defaultFolder={defaultFolder} maxMb={Number(process.env.UPLOAD_MAX_MB || 4)} />
      </details>

      <details className="card add-card">
        <summary>Nouveau document</summary>
        <form action={addDocument} className="stack-form">
          <fieldset className="where">
            <legend>Où créer ce document ?</legend>
            <label className="radio">
              <input type="radio" name="where" value="drive" defaultChecked />
              <span>
                <strong>Dans le Drive</strong> (Google Doc, pour rédiger à plusieurs)
              </span>
            </label>
            <label className="radio">
              <input type="radio" name="where" value="note" />
              <span>
                <strong>Seulement dans l&apos;app</strong> (note courte)
              </span>
            </label>
            <label className="radio">
              <input type="radio" name="where" value="link" />
              <span>
                <strong>Un lien</strong> vers un fichier ou une page existante
              </span>
            </label>
          </fieldset>
          <label htmlFor="doc-title">Titre</label>
          <input id="doc-title" name="title" required />
          <label htmlFor="doc-category">Catégorie</label>
          <input id="doc-category" name="category" list="doc-categories" defaultValue="Informations" />
          <datalist id="doc-categories">
            {allCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <label htmlFor="doc-summary">Description (facultatif)</label>
          <input id="doc-summary" name="summary" />
          <label htmlFor="doc-url">
            Adresse <span className="meta">(seulement pour un lien)</span>
          </label>
          <input id="doc-url" name="url" type="url" placeholder="https://…" />
          <label htmlFor="doc-body">
            Contenu de départ <span className="meta">(Google Doc ou note)</span>
          </label>
          <textarea id="doc-body" name="body" rows={6} />
          <div className="form-actions">
            <button type="submit" className="btn primary">
              Créer
            </button>
          </div>
        </form>
      </details>

      {shown.map((c) => {
        const mine = grouped.get(c) ?? [];
        const files = itemsBy.get(c) ?? [];
        const groups = new Map<string, DriveItem[]>();
        for (const f of files) groups.set(f.group ?? "", [...(groups.get(f.group ?? "") ?? []), f]);
        return (
          <section key={c} className="card">
            <div className="card-head">
              <h2>{c}</h2>
              <span className="meta">{count(c)} document(s)</span>
            </div>
            {mine.length > 0 && (
              <ul className="docs">
                {mine.map((d) => (
                  <DocCard key={d.id} doc={d} />
                ))}
              </ul>
            )}
            {[...groups.entries()]
              .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b, "fr")))
              .map(([g, list]) =>
                g ? (
                  <details key={g} className="sub" open={list.length <= 8}>
                    <summary>
                      <span className="sub-title">{g}</span>
                      <span className="sub-count">{list.length}</span>
                    </summary>
                    <ul className="docs">
                      {list.map((f) => (
                        <DriveRow key={f.id} item={f} />
                      ))}
                    </ul>
                  </details>
                ) : (
                  <ul key="_" className="docs">
                    {list.map((f) => (
                      <DriveRow key={f.id} item={f} />
                    ))}
                  </ul>
                ),
              )}
          </section>
        );
      })}
      {!shown.length && <p className="muted">Aucun document.</p>}
        </div>
      </div>
    </>
  );
}
