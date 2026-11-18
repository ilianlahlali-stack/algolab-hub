import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth";
import { uploadFileToDrive } from "@/lib/drive-docs";
import { docSyncEnabled } from "@/lib/drive-docs";
import { EXCLUDED_NAME } from "@/lib/exclude";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Taille maximale d'un fichier. Vercel refuse les requêtes de plus de 4,5 Mo : on reste en dessous en ligne. */
const MAX_MB = Number(process.env.UPLOAD_MAX_MB || 4);

/** Ajoute un fichier depuis l'ordinateur : il est déposé dans le dossier du Drive choisi, puis classé dans la catégorie choisie. */
export async function POST(request: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user || !isAllowedEmail(auth.user.email)) return Response.json({ error: "Non autorisé." }, { status: 401 });
  if (!docSyncEnabled()) return Response.json({ error: "La connexion au Drive n'est pas configurée." }, { status: 503 });

  const form = await request.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "").trim();
  const category = String(form.get("category") ?? "").trim() || "Informations";
  const title = String(form.get("title") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choisis un fichier." }, { status: 400 });
  if (file.size > MAX_MB * 1024 * 1024) {
    return Response.json({ error: `Fichier trop volumineux (${(file.size / 1048576).toFixed(1)} Mo, maximum ${MAX_MB} Mo ici). Dépose-le directement dans le Drive : il apparaîtra à la synchro.` }, { status: 413 });
  }
  if (!/^[\w-]{10,}$/.test(folder)) return Response.json({ error: "Choisis le dossier du Drive." }, { status: 400 });
  if (EXCLUDED_NAME.test(file.name) || EXCLUDED_NAME.test(title)) return Response.json({ error: "Ce fichier ne peut pas être ajouté ici." }, { status: 400 });

  try {
    const name = file.name;
    const uploaded = await uploadFileToDrive(folder, name, file.type, Buffer.from(await file.arrayBuffer()));
    const { error } = await sb.from("documents").insert({
      title: title || name,
      category,
      kind: "link",
      url: uploaded.webViewLink,
      drive_file_id: uploaded.id,
      summary: `Ajouté depuis l'app (${name})`,
      position: 150,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return Response.json({ ok: true, name: uploaded.name, url: uploaded.webViewLink });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Échec de l'envoi." }, { status: 502 });
  }
}
