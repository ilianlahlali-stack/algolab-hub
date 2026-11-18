/**
 * Éléments du Drive à ne jamais suivre ni afficher (par exemple le dossier d'un autre projet).
 * Expression régulière insensible à la casse lue dans EXCLUDED_DRIVE_NAMES ; un dossier exclu l'est avec tout son contenu.
 * Sans valeur, rien n'est exclu.
 */
function build(): RegExp {
  const raw = process.env.EXCLUDED_DRIVE_NAMES?.trim();
  if (!raw) return /(?!)/; // ne correspond jamais
  try {
    return new RegExp(raw, "i");
  } catch {
    return /(?!)/;
  }
}

export const EXCLUDED_NAME = build();
