import { EXCLUDED_NAME } from "@/lib/exclude";
import type { Doc, DriveFile } from "@/lib/types";

/**
 * Fichiers du Drive surveillé, présentés comme des documents en lecture seule (l'app n'écrit jamais dessus).
 * La catégorie vient du dossier parent ; un fichier déjà présent comme document de l'app n'est pas répété.
 */
export type DriveItem = {
  id: string;
  title: string;
  url: string;
  category: string;
  group: string | null; // sous-dossier d'origine, pour regrouper les longues listes
  typeLabel: string;
  modified: string | null;
  modifiedBy: string | null;
  overridden: boolean; // catégorie choisie à la main
};

const norm = (s: string) => s.normalize("NFC").replace(/[’‘]/g, "'").toLowerCase().trim();

const RAW_BY_FOLDER: Record<string, [string, string | null]> = {
  Slides: ["Cours", "Slides des séances"],
  "Slides des séances": ["Cours", "Slides des séances"],
  "21-10": ["Cours", "Tutoriels"],
  Tutoriels: ["Cours", "Tutoriels"],
  Readings: ["Lectures", null],
  "Boîte à outils": ["Outils", null],
  "Rapports d’étonnement": ["Devoirs", "Rapports d'étonnement"],
  "Rapport d’étonnement Odap": ["Devoirs", "Rapports d'étonnement"],
  Devoirs: ["Devoirs", null],
  "Dossier du groupe": ["Notre travail", null],
  "Ministères Sociaux": ["Notre travail", null],
  "Dossiers de travail": ["Notre travail", null],
  "Point précarité": ["Matériel brut", "Point précarité"],
  "Compte-rendus": ["Matériel brut", "Point précarité"],
  "Recherche utilisateur": ["Matériel brut", "Recherche utilisateur"],
  "Notes d'entretiens Bretagne nov 22": ["Matériel brut", "Recherche utilisateur"],
  "Tests d'interface monitorés": ["Matériel brut", "Recherche utilisateur"],
  "Retours utilisateurs": ["Matériel brut", "Retours utilisateurs"],
  Maquettes: ["Matériel brut", "Maquettes et indicateurs"],
  "Construction des maquettes": ["Matériel brut", "Maquettes et indicateurs"],
  Indicateurs: ["Matériel brut", "Maquettes et indicateurs"],
  "Données et algorithmes": ["Matériel brut", "Données et algorithmes"],
  "Autres documents": ["Matériel brut", "Autres documents"],
  "Documents des partenaires": ["Matériel brut", null],
  VisuDSN: ["Matériel brut", null],
};

/** Les noms de dossiers viennent du Drive : accents composés ou non, apostrophes droites ou courbes. */
const BY_FOLDER = new Map(Object.entries(RAW_BY_FOLDER).map(([k, v]) => [norm(k), v]));

const TYPES: [RegExp, string][] = [
  [/vnd\.google-apps\.document$/, "Google Doc"],
  [/vnd\.google-apps\.spreadsheet$/, "Google Sheet"],
  [/vnd\.google-apps\.presentation$/, "Google Slides"],
  [/pdf$/, "PDF"],
  [/wordprocessingml|msword|opendocument\.text/, "Word"],
  [/spreadsheetml|ms-excel|opendocument\.spreadsheet/, "Excel"],
  [/presentationml|ms-powerpoint/, "PowerPoint"],
  [/^image\//, "Image"],
  [/zip|compressed/, "Archive"],
  [/html$/, "Page web"],
];
const typeLabel = (mime: string | null) => TYPES.find(([re]) => re.test(mime ?? ""))?.[1] ?? "Fichier";

function categorize(f: DriveFile): [string, string | null] {
  if (/journal d.enqu[êe]te/i.test(f.name)) return [/template/i.test(f.name) ? "Outils" : "Journal d'enquête", null];
  if (/template/i.test(f.name)) return ["Outils", null];
  return BY_FOLDER.get(norm(f.parent_name ?? "")) ?? ["Autres fichiers du Drive", f.parent_name];
}

export function driveItems(files: DriveFile[], docs: Doc[], overrides: Map<string, string> = new Map()): DriveItem[] {
  const known = new Set(docs.map((d) => d.drive_file_id).filter(Boolean) as string[]);
  const urls = docs.map((d) => d.url ?? "");
  const seen = new Set<string>();
  const out: DriveItem[] = [];
  for (const f of files) {
    if (seen.has(f.id) || f.trashed) continue;
    seen.add(f.id);
    if (f.mime_type === "application/vnd.google-apps.folder") continue;
    if (f.name.startsWith(".")) continue; // fichiers système (.DS_Store…)
    if (EXCLUDED_NAME.test(f.name) || EXCLUDED_NAME.test(f.parent_name ?? "")) continue;
    if (known.has(f.id) || urls.some((u) => u.includes(f.id))) continue; // déjà un document de l'app
    const forced = overrides.get(f.id);
    const [category, group] = forced ? [forced, null] : categorize(f);
    out.push({
      id: f.id,
      title: f.name,
      url: f.web_view_link ?? `https://drive.google.com/file/d/${f.id}/view`,
      category,
      group,
      typeLabel: typeLabel(f.mime_type),
      modified: f.modified_time,
      modifiedBy: f.last_modifying_user,
      overridden: !!forced,
    });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, "fr", { numeric: true }));
}
