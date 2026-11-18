import { syncDocs, type DocSyncSummary } from "@/lib/drive-docs";
import { EXCLUDED_NAME } from "@/lib/exclude";
import { googleAccessToken } from "@/lib/google";
import { adminClient } from "@/lib/supabase/admin";
import type { DriveFolder } from "@/lib/types";

/**
 * Synchro Drive : parcourt chaque dossier surveillé (et ses sous-dossiers),
 * compare avec l'état connu en base et enregistre les ajouts, modifications et retraits.
 * Les dossiers sont lus en métadonnées seulement ; le contenu n'est lu que pour les fiches reliées à un Google Doc
 * (voir drive-fiches.ts).
 */

const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_FILES_PER_ROOT = 3000;


type GFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  lastModifyingUser?: { displayName?: string; emailAddress?: string };
};

type Found = { file: GFile; parentName: string };

type KnownRow = {
  id: string;
  name: string;
  modified_time: string | null;
  web_view_link: string | null;
  parent_name: string | null;
  trashed: boolean;
};

export type SyncSummary = {
  folders: { label: string; files: number; added: number; modified: number; removed: number; firstRun: boolean }[];
  docs?: DocSyncSummary;
  durationMs: number;
};

async function listChildren(token: string, folderId: string): Promise<GFile[]> {
  const out: GFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, lastModifyingUser(displayName, emailAddress))",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Drive API ${res.status} sur le dossier ${folderId} : ${await res.text()}`);
    const json = (await res.json()) as { files?: GFile[]; nextPageToken?: string };
    out.push(...(json.files ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);
  return out;
}

/** Un même dossier est listé une seule fois par synchro, même s'il figure sous plusieurs dossiers racines. */
type ListCache = Map<string, Promise<GFile[]>>;

function listCached(token: string, folderId: string, cache: ListCache): Promise<GFile[]> {
  let p = cache.get(folderId);
  if (!p) {
    p = listChildren(token, folderId);
    cache.set(folderId, p);
  }
  return p;
}

/** Parcours en largeur, un niveau à la fois, avec les dossiers d'un niveau listés en parallèle. */
async function walk(token: string, root: DriveFolder, cache: ListCache): Promise<Found[]> {
  const found: Found[] = [];
  const seen = new Set<string>([root.id]);
  let level: { id: string; name: string }[] = [{ id: root.id, name: root.label }];
  while (level.length && found.length < MAX_FILES_PER_ROOT) {
    const listings = await Promise.all(level.map((f) => listCached(token, f.id, cache)));
    const next: { id: string; name: string }[] = [];
    level.forEach((folder, i) => {
      for (const file of listings[i]) {
        if (EXCLUDED_NAME.test(file.name)) continue;
        found.push({ file, parentName: folder.name });
        if (file.mimeType === FOLDER_MIME && !seen.has(file.id)) {
          seen.add(file.id);
          next.push({ id: file.id, name: file.name });
        }
      }
    });
    level = next;
  }
  return found;
}

const sameTime = (a: string | null, b?: string) => !!a && !!b && new Date(a).getTime() === new Date(b).getTime();

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function syncDrive(): Promise<SyncSummary> {
  const started = Date.now();
  const db = adminClient();
  const { data: folders, error } = await db.from("drive_folders").select("id, label, last_synced_at");
  if (error) throw new Error(error.message);

  const token = await googleAccessToken();
  const summary: SyncSummary = { folders: [], durationMs: 0 };
  const cache: ListCache = new Map();

  for (const root of (folders ?? []) as DriveFolder[]) {
    const found = await walk(token, root, cache);
    const firstRun = !root.last_synced_at;

    const { data: knownData, error: knownErr } = await db
      .from("drive_files")
      .select("id, name, modified_time, web_view_link, parent_name, trashed")
      .eq("root_id", root.id);
    if (knownErr) throw new Error(knownErr.message);
    const known = new Map(((knownData ?? []) as KnownRow[]).map((k) => [k.id, k]));

    const now = new Date().toISOString();
    const events: Record<string, unknown>[] = [];
    const seenIds = new Set<string>();
    let added = 0;
    let modified = 0;

    const rows = found.map(({ file, parentName }) => {
      seenIds.add(file.id);
      const prev = known.get(file.id);
      const actor = file.lastModifyingUser?.displayName ?? file.lastModifyingUser?.emailAddress ?? null;
      const base = {
        root_id: root.id,
        file_id: file.id,
        name: file.name,
        folder_label: root.label,
        parent_name: parentName,
        web_view_link: file.webViewLink ?? null,
        actor,
        happened_at: file.modifiedTime ?? now,
      };
      if (!firstRun) {
        if (!prev || prev.trashed) {
          events.push({ ...base, kind: "added" });
          added++;
        } else if (file.mimeType !== FOLDER_MIME && !sameTime(prev.modified_time, file.modifiedTime)) {
          events.push({ ...base, kind: "modified" });
          modified++;
        }
      }
      return {
        root_id: root.id,
        id: file.id,
        name: file.name,
        mime_type: file.mimeType,
        parent_name: parentName,
        web_view_link: file.webViewLink ?? null,
        modified_time: file.modifiedTime ?? null,
        last_modifying_user: actor,
        trashed: false,
      };
    });

    // Si on a atteint la limite, on ne peut pas conclure qu'un fichier absent a été retiré.
    const complete = found.length < MAX_FILES_PER_ROOT;
    const gone = complete ? [...known.values()].filter((k) => !k.trashed && !seenIds.has(k.id)) : [];
    for (const k of gone) {
      events.push({
        root_id: root.id,
        file_id: k.id,
        name: k.name,
        kind: "removed",
        folder_label: root.label,
        parent_name: k.parent_name,
        web_view_link: k.web_view_link,
        actor: null,
        happened_at: now,
      });
    }

    for (const part of chunks(rows, 500)) {
      const { error: upErr } = await db.from("drive_files").upsert(part, { onConflict: "root_id,id" });
      if (upErr) throw new Error(upErr.message);
    }
    for (const part of chunks(gone.map((g) => g.id), 200)) {
      const { error: rmErr } = await db.from("drive_files").update({ trashed: true }).eq("root_id", root.id).in("id", part);
      if (rmErr) throw new Error(rmErr.message);
    }
    for (const part of chunks(events, 500)) {
      const { error: evErr } = await db.from("drive_events").insert(part);
      if (evErr) throw new Error(evErr.message);
    }
    const { error: folderErr } = await db.from("drive_folders").update({ last_synced_at: now }).eq("id", root.id);
    if (folderErr) throw new Error(folderErr.message);

    summary.folders.push({ label: root.label, files: rows.length, added, modified, removed: gone.length, firstRun });
  }

  summary.docs = await syncDocs(token);

  summary.durationMs = Date.now() - started;
  return summary;
}
