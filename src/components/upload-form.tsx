"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Folder = { id: string; label: string };

/** Ajout d'un fichier depuis l'ordinateur : 1. fichier, 2. catégorie, 3. dossier du Drive, puis envoi dans le Drive. */
export function UploadForm({ categories, folders, defaultFolder, maxMb }: { categories: string[]; folders: Folder[]; defaultFolder: string; maxMb: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text?: string }>({ kind: "idle" });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setStatus({ kind: "busy", text: "Envoi dans le Drive…" });
    try {
      const res = await fetch("/api/upload", { method: "POST", body: data });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; name?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `Échec de l'envoi (${res.status}).`);
      formRef.current?.reset();
      setStatus({ kind: "ok", text: `« ${json.name} » est dans le Drive et dans la liste des documents.` });
      router.refresh();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Échec de l'envoi." });
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="stack-form">
      <label htmlFor="up-file">1. Fichier depuis ton ordinateur (max {maxMb} Mo)</label>
      <input
        id="up-file"
        name="file"
        type="file"
        required
        onChange={(e) => {
          const t = formRef.current?.elements.namedItem("title") as HTMLInputElement | null;
          const name = e.target.files?.[0]?.name;
          if (t && name && !t.value) t.value = name.replace(/\.[^.]+$/, "");
        }}
      />
      <label htmlFor="up-title">Titre affiché</label>
      <input id="up-title" name="title" placeholder="Par défaut : le nom du fichier" />
      <label htmlFor="up-cat">2. Catégorie</label>
      <input id="up-cat" name="category" list="up-categories" defaultValue="Informations" required />
      <datalist id="up-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <label htmlFor="up-folder">3. Dossier du Drive où le publier</label>
      <select id="up-folder" name="folder" defaultValue={defaultFolder} required>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={status.kind === "busy"}>
          {status.kind === "busy" ? "Envoi…" : "Ajouter et publier dans le Drive"}
        </button>
      </div>
      {status.kind === "error" && <p className="alert">{status.text}</p>}
      {status.kind === "ok" && <p className="pill ok">{status.text}</p>}
      {status.kind === "busy" && <p className="meta">{status.text}</p>}
    </form>
  );
}
