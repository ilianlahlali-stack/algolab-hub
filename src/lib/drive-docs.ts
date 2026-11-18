import { googleAccessToken, googleConfigured } from "@/lib/google";
import { markdownToHtml, normalizeDocMarkdown } from "@/lib/markdown-html";
import { adminClient } from "@/lib/supabase/admin";
import type { Doc } from "@/lib/types";

/**
 * Documents <-> Google Docs, dans les deux sens.
 *
 * - Seuls les documents de type « gdoc » (choisis comme tels à la création) ont un Google Doc,
 *   créé par l'app dans le dossier DRIVE_DOCS_FOLDER_ID. Les notes et les liens restent dans l'app.
 * - L'app ne touche qu'aux Docs qu'elle a créés (scope drive.file) : les documents existants
 *   du Drive (journal d'enquête, CR…) ne sont jamais modifiés.
 * - App -> Drive : à chaque enregistrement. Drive -> app : à chaque synchro (15 min, ou bouton).
 * - En cas de modification simultanée, la dernière écriture gagne ; l'historique des versions
 *   du Google Doc permet de récupérer l'ancien texte.
 */

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const DOC_MIME = "application/vnd.google-apps.document";

export type DocSyncSummary = { created: number; pushed: number; pulled: number; errors: string[] };

type DocMeta = {
  id: string;
  name: string;
  modifiedTime: string;
  trashed?: boolean;
  lastModifyingUser?: { displayName?: string; emailAddress?: string };
};

const folderId = () => process.env.DRIVE_DOCS_FOLDER_ID || process.env.DRIVE_FICHES_FOLDER_ID || "";
export const docSyncEnabled = () => googleConfigured() && !!folderId();

/** Formats de téléchargement d'un Google Doc : extension, type MIME d'export, libellé. */
export const EXPORT_FORMATS = {
  pdf: { mime: "application/pdf", label: "PDF" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word (.docx)" },
  odt: { mime: "application/vnd.oasis.opendocument.text", label: "OpenDocument (.odt)" },
  md: { mime: "text/markdown", label: "Markdown (.md)" },
  txt: { mime: "text/plain", label: "Texte brut (.txt)" },
  html: { mime: "text/html", label: "Page web (.html)" },
} as const;
export type ExportFormat = keyof typeof EXPORT_FORMATS;

function multipart(metadata: object, html: string) {
  const boundary = `algolab${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
  return { body, contentType: `multipart/related; boundary=${boundary}` };
}

async function check(res: Response, what: string) {
  if (!res.ok) throw new Error(`Drive (${what}) : ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function getMeta(token: string, id: string): Promise<DocMeta | null> {
  const params = new URLSearchParams({
    fields: "id,name,modifiedTime,trashed,lastModifyingUser(displayName,emailAddress)",
    supportsAllDrives: "true",
  });
  const res = await fetch(`${API}/files/${id}?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 404) return null;
  return (await (await check(res, "lecture du Doc")).json()) as DocMeta;
}

async function createGoogleDoc(token: string, doc: Pick<Doc, "title" | "body">): Promise<DocMeta> {
  const { body, contentType } = multipart({ name: doc.title, mimeType: DOC_MIME, parents: [folderId()] }, markdownToHtml(doc.body));
  const params = new URLSearchParams({ uploadType: "multipart", supportsAllDrives: "true", fields: "id,name,modifiedTime" });
  const res = await fetch(`${UPLOAD}/files?${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body,
    cache: "no-store",
  });
  return (await (await check(res, "création du Doc")).json()) as DocMeta;
}

async function updateGoogleDoc(token: string, id: string, doc: Pick<Doc, "title" | "body">): Promise<DocMeta> {
  const { body, contentType } = multipart({ name: doc.title }, markdownToHtml(doc.body));
  const params = new URLSearchParams({ uploadType: "multipart", supportsAllDrives: "true", fields: "id,name,modifiedTime" });
  const res = await fetch(`${UPLOAD}/files/${id}?${params}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body,
    cache: "no-store",
  });
  return (await (await check(res, "mise à jour du Doc")).json()) as DocMeta;
}

async function exportMarkdown(token: string, id: string): Promise<string> {
  const params = new URLSearchParams({ mimeType: "text/markdown" });
  const res = await fetch(`${API}/files/${id}/export?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  return normalizeDocMarkdown(await (await check(res, "export du Doc")).text());
}

/** Télécharge un Google Doc dans le format demandé (export Drive). */
export async function exportGoogleDoc(fileId: string, format: ExportFormat): Promise<{ data: ArrayBuffer; mime: string }> {
  const token = await googleAccessToken();
  const { mime } = EXPORT_FORMATS[format];
  const res = await fetch(`${API}/files/${fileId}/export?${new URLSearchParams({ mimeType: mime })}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  await check(res, "téléchargement du Doc");
  return { data: await res.arrayBuffer(), mime };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Envoie un document « gdoc » vers son Google Doc (le crée au besoin). Ne lève jamais : l'erreur est notée sur le document. */
export async function pushDoc(docId: string, token?: string): Promise<"created" | "pushed" | "skipped" | "error"> {
  if (!docSyncEnabled()) return "skipped";
  const db = adminClient();
  const { data } = await db.from("documents").select("*").eq("id", docId).maybeSingle();
  const doc = data as Doc | null;
  if (!doc || doc.kind !== "gdoc") return "skipped";
  try {
    const t = token ?? (await googleAccessToken());
    const created = !doc.drive_file_id;
    const meta = doc.drive_file_id ? await updateGoogleDoc(t, doc.drive_file_id, doc) : await createGoogleDoc(t, doc);
    const { error } = await db
      .from("documents")
      .update({ drive_file_id: meta.id, drive_modified_time: meta.modifiedTime, drive_error: null })
      .eq("id", doc.id);
    if (error) throw new Error(error.message);
    return created ? "created" : "pushed";
  } catch (e) {
    await db.from("documents").update({ drive_error: message(e).slice(0, 500) }).eq("id", docId);
    return "error";
  }
}

/**
 * Passe sur tous les documents « gdoc » : crée les Docs manquants, renvoie vers le Drive les
 * enregistrements qui ont échoué, et rapatrie les modifications faites dans les Google Docs.
 */
export async function syncDocs(token: string): Promise<DocSyncSummary> {
  const summary: DocSyncSummary = { created: 0, pushed: 0, pulled: 0, errors: [] };
  if (!folderId()) return summary;

  const db = adminClient();
  const { data, error } = await db.from("documents").select("*").eq("kind", "gdoc");
  if (error) throw new Error(error.message);

  for (const doc of (data ?? []) as Doc[]) {
    try {
      if (!doc.drive_file_id || doc.drive_error) {
        const r = await pushDoc(doc.id, token);
        if (r === "created") summary.created++;
        else if (r === "pushed") summary.pushed++;
        else if (r === "error") summary.errors.push(`${doc.title} : envoi vers le Drive impossible`);
        continue;
      }

      const meta = await getMeta(token, doc.drive_file_id);
      if (!meta || meta.trashed) {
        // Doc supprimé côté Drive : on détache le document, il en retrouvera un au prochain enregistrement.
        await db.from("documents").update({ drive_file_id: null, drive_modified_time: null }).eq("id", doc.id);
        continue;
      }
      const same = doc.drive_modified_time && new Date(doc.drive_modified_time).getTime() === new Date(meta.modifiedTime).getTime();
      if (same) continue;

      const body = await exportMarkdown(token, doc.drive_file_id);
      const { error: upErr } = await db
        .from("documents")
        .update({
          title: meta.name,
          body,
          drive_modified_time: meta.modifiedTime,
          drive_error: null,
          updated_by: meta.lastModifyingUser?.emailAddress ?? meta.lastModifyingUser?.displayName ?? doc.updated_by,
        })
        .eq("id", doc.id);
      if (upErr) throw new Error(upErr.message);
      summary.pulled++;
    } catch (e) {
      summary.errors.push(`${doc.title} : ${message(e)}`);
    }
  }
  return summary;
}

export type UploadedFile = { id: string; name: string; mimeType: string; webViewLink: string; modifiedTime: string };

/** Dépose un fichier tel quel (sans conversion) dans un dossier du Drive. Ne modifie ni ne supprime rien d'existant. */
export async function uploadFileToDrive(folder: string, name: string, mime: string, content: Buffer): Promise<UploadedFile> {
  const token = await googleAccessToken();
  const boundary = `algolab${Math.random().toString(36).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folder] })}\r\n` +
      `--${boundary}\r\nContent-Type: ${mime || "application/octet-stream"}\r\n\r\n`,
  );
  const body = Buffer.concat([head, content, Buffer.from(`\r\n--${boundary}--`)]);
  const params = new URLSearchParams({ uploadType: "multipart", supportsAllDrives: "true", fields: "id,name,mimeType,webViewLink,modifiedTime" });
  const res = await fetch(`${UPLOAD}/files?${params}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
    cache: "no-store",
  });
  return (await (await check(res, "envoi du fichier")).json()) as UploadedFile;
}
