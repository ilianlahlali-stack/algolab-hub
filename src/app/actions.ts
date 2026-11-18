"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ALLOWED_DOMAIN, requireMember } from "@/lib/auth";
import { syncDrive } from "@/lib/drive";
import { pushDoc } from "@/lib/drive-docs";
import { createClient } from "@/lib/supabase/server";

const str = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
};
const orNull = (v: string) => (v ? v : null);
const isUrl = (v: string) => /^https?:\/\//i.test(v);

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Rafraîchit toutes les pages (la barre latérale, la recherche et l'accueil lisent les mêmes données). */
function done() {
  revalidatePath("/", "layout");
}

/* ---------- Connexion ---------- */

export async function signInWithGoogle() {
  const sb = await createClient();
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || h.get("origin") || "http://localhost:3000";
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: { hd: ALLOWED_DOMAIN, prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/login");
}

/* ---------- Tâches (le « breakdown » d'une deadline) ---------- */

export async function addTask(form: FormData) {
  const { sb } = await requireMember();
  const title = str(form, "title");
  if (!title) return;
  check(
    (
      await sb.from("tasks").insert({
        title,
        owner: orNull(str(form, "owner")),
        due: orNull(str(form, "due")),
        deadline_id: orNull(str(form, "deadline_id")),
      })
    ).error,
  );
  done();
}

export async function toggleTask(form: FormData) {
  const { sb } = await requireMember();
  check((await sb.from("tasks").update({ done: str(form, "done") !== "true" }).eq("id", str(form, "id"))).error);
  done();
}

export async function deleteTask(form: FormData) {
  const { sb } = await requireMember();
  check((await sb.from("tasks").delete().eq("id", str(form, "id"))).error);
  done();
}

/* ---------- Deadlines ---------- */

export async function addDeadline(form: FormData) {
  const { sb } = await requireMember();
  const title = str(form, "title");
  const due = str(form, "due");
  if (!title || !due) return;
  check((await sb.from("deadlines").insert({ title, due, details: orNull(str(form, "details")) })).error);
  done();
}

export async function updateDeadline(form: FormData) {
  const { sb } = await requireMember();
  const title = str(form, "title");
  const due = str(form, "due");
  if (!title || !due) return;
  check((await sb.from("deadlines").update({ title, due, details: orNull(str(form, "details")) }).eq("id", str(form, "id"))).error);
  done();
}

export async function deleteDeadline(form: FormData) {
  const { sb } = await requireMember();
  check((await sb.from("deadlines").delete().eq("id", str(form, "id"))).error);
  done();
}

/* ---------- Calendrier (séances, rendez-vous, autres événements) ---------- */

const KINDS = ["seance", "rdv", "autre"];

export async function addSession(form: FormData) {
  const { sb } = await requireMember();
  const day = str(form, "day");
  const title = str(form, "title");
  if (!day || !title) return;
  const kind = KINDS.includes(str(form, "kind")) ? str(form, "kind") : "autre";
  check(
    (
      await sb.from("sessions").insert({
        day,
        title,
        kind,
        details: orNull(str(form, "details")),
        start_time: orNull(str(form, "start_time")),
        end_time: orNull(str(form, "end_time")),
      })
    ).error,
  );
  done();
}

export async function updateSession(form: FormData) {
  const { sb } = await requireMember();
  const day = str(form, "day");
  const title = str(form, "title");
  if (!day || !title) return;
  const kind = KINDS.includes(str(form, "kind")) ? str(form, "kind") : "autre";
  check(
    (
      await sb
        .from("sessions")
        .update({
          day,
          title,
          kind,
          details: orNull(str(form, "details")),
          start_time: orNull(str(form, "start_time")),
          end_time: orNull(str(form, "end_time")),
        })
        .eq("id", str(form, "id"))
    ).error,
  );
  done();
}

export async function deleteSession(form: FormData) {
  const { sb } = await requireMember();
  check((await sb.from("sessions").delete().eq("id", str(form, "id"))).error);
  done();
}

/* ---------- Personnes ---------- */

export async function addPerson(form: FormData) {
  const { sb } = await requireMember();
  const name = str(form, "name");
  if (!name) return;
  const linkedin = str(form, "linkedin");
  check(
    (
      await sb.from("people").insert({
        name,
        category: str(form, "category") || "Groupe",
        role: orNull(str(form, "role")),
        email: orNull(str(form, "email")),
        linkedin: isUrl(linkedin) ? linkedin : null,
        position: 500,
      })
    ).error,
  );
  done();
}

export async function updatePerson(form: FormData) {
  const { sb } = await requireMember();
  const name = str(form, "name");
  if (!name) return;
  const linkedin = str(form, "linkedin");
  check(
    (
      await sb
        .from("people")
        .update({
          name,
          category: str(form, "category") || "Groupe",
          role: orNull(str(form, "role")),
          email: orNull(str(form, "email")),
          linkedin: isUrl(linkedin) ? linkedin : null,
        })
        .eq("id", str(form, "id"))
    ).error,
  );
  done();
}

export async function deletePerson(form: FormData) {
  const { sb } = await requireMember();
  check((await sb.from("people").delete().eq("id", str(form, "id"))).error);
  done();
}

/* ---------- Documents ---------- */

/** Création : « où ? » = Google Doc dans le Drive, note dans l'app, ou lien vers un fichier existant. */
export async function addDocument(form: FormData) {
  const { sb } = await requireMember();
  const title = str(form, "title");
  if (!title) return;
  const where = str(form, "where");
  const url = str(form, "url");
  const kind = where === "drive" ? "gdoc" : where === "link" ? "link" : "note";
  if (kind === "link" && !isUrl(url)) return;

  const { data, error } = await sb
    .from("documents")
    .insert({
      title,
      kind,
      category: str(form, "category") || "Informations",
      summary: orNull(str(form, "summary")),
      body: kind === "link" ? "" : str(form, "body"),
      url: kind === "link" ? url : null,
    })
    .select("id")
    .single();
  check(error);
  if (kind === "gdoc" && data) await pushDoc(data.id as string); // crée le Google Doc dans le Drive
  done();
}

export async function saveDocument(form: FormData) {
  const { sb, user } = await requireMember();
  const id = str(form, "id");
  const title = str(form, "title");
  if (!title) return;
  const fields: Record<string, unknown> = {
    title,
    category: str(form, "category") || "Informations",
    summary: orNull(str(form, "summary")),
    updated_by: user.email,
  };
  if (form.has("body")) fields.body = str(form, "body");
  if (form.has("url") && isUrl(str(form, "url"))) fields.url = str(form, "url");
  check((await sb.from("documents").update(fields).eq("id", id)).error);
  await pushDoc(id); // met à jour le Google Doc s'il y en a un ; l'erreur éventuelle est notée sur le document
  done();
}

/** Transforme une note de l'app en Google Doc dans le Drive. */
export async function moveToDrive(form: FormData) {
  const { sb } = await requireMember();
  const id = str(form, "id");
  check((await sb.from("documents").update({ kind: "gdoc" }).eq("id", id).eq("kind", "note")).error);
  await pushDoc(id);
  done();
}

export async function deleteDocument(form: FormData) {
  const { sb } = await requireMember();
  check((await sb.from("documents").delete().eq("id", str(form, "id"))).error); // le Google Doc éventuel reste dans le Drive
  done();
}

/** Range un fichier du Drive dans une autre catégorie (catégorie vide : retour au classement automatique). */
export async function setFileCategory(form: FormData) {
  const { sb } = await requireMember();
  const fileId = str(form, "file_id");
  const category = str(form, "category");
  if (!fileId) return;
  if (!category) check((await sb.from("file_categories").delete().eq("file_id", fileId)).error);
  else check((await sb.from("file_categories").upsert({ file_id: fileId, category, updated_at: new Date().toISOString() })).error);
  done();
}

/* ---------- Mur : publications et réponses ---------- */

const TAGS = ["impression", "idee", "question", "decision"];

/** Publie sur le mur, ou répond à une publication (parent_id). Une réponse se rattache toujours à la publication d'origine. */
export async function addPost(form: FormData) {
  const { sb } = await requireMember();
  const body = str(form, "body");
  if (!body) return;
  let parent = orNull(str(form, "parent_id"));
  if (parent) {
    const { data } = await sb.from("notes").select("id, parent_id").eq("id", parent).maybeSingle();
    if (!data) return;
    parent = (data.parent_id as string | null) ?? (data.id as string);
  }
  const tag = !parent && TAGS.includes(str(form, "tag")) ? str(form, "tag") : null;
  check((await sb.from("notes").insert({ body, parent_id: parent, tag })).error);
  done();
}

export async function deleteNote(form: FormData) {
  const { sb } = await requireMember();
  check((await sb.from("notes").delete().eq("id", str(form, "id"))).error); // seul l'auteur peut supprimer ; les réponses partent avec la publication
  done();
}

/* ---------- Drive ---------- */

export async function addDriveFolder(form: FormData) {
  const { sb } = await requireMember();
  const raw = str(form, "folder");
  const label = str(form, "label");
  // Accepte un identifiant nu ou un lien « …/folders/<id> ».
  const id = /folders\/([\w-]+)/.exec(raw)?.[1] ?? (/^[\w-]{10,}$/.test(raw) ? raw : "");
  if (!id || !label) return;
  check((await sb.from("drive_folders").upsert({ id, label })).error);
  done();
}

export async function syncDriveNow() {
  await requireMember();
  await syncDrive();
  done();
}
