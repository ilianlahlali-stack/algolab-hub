import type { NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth";
import { EXPORT_FORMATS, exportGoogleDoc, type ExportFormat } from "@/lib/drive-docs";
import { markdownToHtml } from "@/lib/markdown-html";
import { createClient } from "@/lib/supabase/server";
import type { Doc } from "@/lib/types";

/** Télécharge un document dans le format choisi (?format=pdf|docx|odt|md|txt|html). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/documents/[id]/export">) {
  const { id } = await ctx.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user || !isAllowedEmail(auth.user.email)) return new Response("Non autorisé.", { status: 401 });

  const { data } = await sb.from("documents").select("*").eq("id", id).maybeSingle();
  const doc = data as Doc | null;
  if (!doc || doc.kind === "link") return new Response("Document introuvable.", { status: 404 });

  const requested = request.nextUrl.searchParams.get("format") ?? "pdf";
  if (!(requested in EXPORT_FORMATS)) return new Response("Format inconnu.", { status: 400 });
  const format = requested as ExportFormat;
  const filename = `${doc.title.replace(/[^\p{L}\p{N}._ -]+/gu, "").trim() || "document"}.${format}`;
  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;

  try {
    if (doc.kind === "gdoc" && doc.drive_file_id) {
      const { data: bytes, mime } = await exportGoogleDoc(doc.drive_file_id, format);
      return new Response(bytes, { headers: { "Content-Type": mime, "Content-Disposition": disposition } });
    }
    // Note de l'app : formats texte uniquement.
    if (format === "md") return new Response(`# ${doc.title}\n\n${doc.body}\n`, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": disposition } });
    if (format === "txt") return new Response(`${doc.title}\n\n${doc.body}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": disposition } });
    if (format === "html") {
      const html = markdownToHtml(`## ${doc.title}\n\n${doc.body}`);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": disposition } });
    }
    return new Response("Ce format n'est pas disponible pour une note de l'app. Envoie-la vers le Drive pour l'obtenir en PDF ou Word.", { status: 400 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Erreur de téléchargement.", { status: 502 });
  }
}
