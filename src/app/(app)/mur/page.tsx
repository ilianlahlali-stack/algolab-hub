import Link from "next/link";
import { addPost, deleteNote } from "@/app/actions";
import { DeleteButton, Hidden, PageHead } from "@/components/ui";
import { displayName, requireMember } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import type { Note } from "@/lib/types";

export const metadata = { title: "Mur · AlgoLab hub" };

const TAGS: { value: NonNullable<Note["tag"]>; label: string; cls: string }[] = [
  { value: "impression", label: "Impression", cls: "info" },
  { value: "idee", label: "Idée", cls: "ok" },
  { value: "question", label: "Question", cls: "todo" },
  { value: "decision", label: "Décision", cls: "info" },
];

const initials = (email: string | null) =>
  displayName(email)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

function Author({ note }: { note: Note }) {
  return (
    <div className="author">
      <span className="avatar" aria-hidden="true">
        {initials(note.author)}
      </span>
      <div>
        <strong>{displayName(note.author) || "Quelqu'un"}</strong>
        <span className="meta"> · {fmtDateTime(note.created_at)}</span>
      </div>
    </div>
  );
}

export default async function WallPage({ searchParams }: PageProps<"/mur">) {
  const { sb, user } = await requireMember();
  const params = await searchParams;
  const tag = typeof params.tag === "string" && TAGS.some((t) => t.value === params.tag) ? params.tag : "";

  const { data } = await sb.from("notes").select("*").order("created_at", { ascending: false }).limit(500);
  const all = (data ?? []) as Note[];
  const posts = all.filter((n) => !n.parent_id);
  const replies = new Map<string, Note[]>();
  for (const r of all.filter((n) => n.parent_id).reverse()) replies.set(r.parent_id!, [...(replies.get(r.parent_id!) ?? []), r]); // plus ancienne d'abord
  const shown = tag ? posts.filter((p) => p.tag === tag) : posts;

  return (
    <>
      <PageHead title="Mur" sub="Commentaires, impressions, idées et questions du groupe. Tout le monde peut publier et répondre." />

      <section className="card">
        <form action={addPost} className="stack-form">
          <label htmlFor="post-body" className="sr-only">
            Nouvelle publication
          </label>
          <textarea id="post-body" name="body" rows={3} placeholder="Une impression, une idée, une question, une décision…" required />
          <div className="composer-foot">
            <label htmlFor="post-tag" className="sr-only">
              Type de publication
            </label>
            <select id="post-tag" name="tag" defaultValue="">
              <option value="">Sans étiquette</option>
              {TAGS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn primary">
              Publier
            </button>
          </div>
        </form>
      </section>

      <div className="chips">
        <Link href="/mur" className={`chip ${tag ? "" : "on"}`}>
          Tout ({posts.length})
        </Link>
        {TAGS.map((t) => (
          <Link key={t.value} href={`/mur?tag=${t.value}`} className={`chip ${tag === t.value ? "on" : ""}`}>
            {t.label} ({posts.filter((p) => p.tag === t.value).length})
          </Link>
        ))}
      </div>

      {shown.map((p) => {
        const list = replies.get(p.id) ?? [];
        const t = TAGS.find((x) => x.value === p.tag);
        return (
          <article key={p.id} className="card post">
            <div className="post-head">
              <Author note={p} />
              <div className="post-tools">
                {t && <span className={`pill ${t.cls}`}>{t.label}</span>}
                {p.author === user.email && <DeleteButton action={deleteNote} id={p.id} label="Supprimer cette publication" />}
              </div>
            </div>
            <p className="note-body">{p.body}</p>

            {list.length > 0 && (
              <ul className="replies">
                {list.map((r) => (
                  <li key={r.id}>
                    <div className="post-head">
                      <Author note={r} />
                      {r.author === user.email && <DeleteButton action={deleteNote} id={r.id} label="Supprimer cette réponse" />}
                    </div>
                    <p className="note-body">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}

            <details className="edit">
              <summary>{list.length ? `Répondre (${list.length} réponse${list.length > 1 ? "s" : ""})` : "Répondre"}</summary>
              <form action={addPost} className="stack-form">
                <Hidden name="parent_id" value={p.id} />
                <label htmlFor={`reply-${p.id}`} className="sr-only">
                  Ta réponse
                </label>
                <textarea id={`reply-${p.id}`} name="body" rows={2} placeholder="Ta réponse…" required />
                <div className="form-actions">
                  <button type="submit" className="btn">
                    Répondre
                  </button>
                </div>
              </form>
            </details>
          </article>
        );
      })}
      {!shown.length && <p className="muted">{tag ? "Aucune publication avec cette étiquette." : "Le mur est vide : lance la discussion."}</p>}
    </>
  );
}
