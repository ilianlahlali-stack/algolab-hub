"use client";

/** Replie ou déplie d'un coup toutes les sous-sections (éléments <details class="sub">) de la page. */
export function CollapseAll() {
  const set = (open: boolean) => document.querySelectorAll<HTMLDetailsElement>("details.sub").forEach((d) => (d.open = open));
  return (
    <div className="collapse-all">
      <button type="button" className="btn small" onClick={() => set(false)}>
        Tout replier
      </button>
      <button type="button" className="btn small" onClick={() => set(true)}>
        Tout déplier
      </button>
    </div>
  );
}
