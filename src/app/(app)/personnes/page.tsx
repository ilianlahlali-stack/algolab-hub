import { addPerson, deletePerson, updatePerson } from "@/app/actions";
import { Hidden, PageHead } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import type { Person } from "@/lib/types";

export const metadata = { title: "Personnes · AlgoLab hub" };

const CATEGORY_ORDER = ["Groupe", "Équipe AlgoLab", "Partenaires VisuDSN"];

function PersonForm({ p, categories }: { p?: Person; categories: string[] }) {
  const id = p?.id ?? "new";
  return (
    <form action={p ? updatePerson : addPerson} className="stack-form">
      {p && <Hidden name="id" value={p.id} />}
      <label htmlFor={`n-${id}`}>Nom</label>
      <input id={`n-${id}`} name="name" defaultValue={p?.name} required />
      <label htmlFor={`c-${id}`}>Catégorie</label>
      <input id={`c-${id}`} name="category" defaultValue={p?.category ?? "Groupe"} list="people-categories" />
      <datalist id="people-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <label htmlFor={`r-${id}`}>Rôle (facultatif)</label>
      <input id={`r-${id}`} name="role" defaultValue={p?.role ?? ""} />
      <label htmlFor={`e-${id}`}>E-mail (Sciences Po pour les étudiants et l&apos;équipe)</label>
      <input id={`e-${id}`} name="email" type="email" defaultValue={p?.email ?? ""} placeholder="prenom.nom@sciencespo.fr" />
      <label htmlFor={`l-${id}`}>LinkedIn (pour les personnes hors Sciences Po)</label>
      <input id={`l-${id}`} name="linkedin" type="url" defaultValue={p?.linkedin ?? ""} placeholder="https://www.linkedin.com/in/…" />
      <div className="form-actions">
        <button type="submit" className="btn primary">
          {p ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

export default async function PeoplePage() {
  const { sb } = await requireMember();
  const { data } = await sb.from("people").select("*").order("position").order("name");
  const people = (data ?? []) as Person[];

  const grouped = new Map<string, Person[]>();
  for (const p of people) grouped.set(p.category, [...(grouped.get(p.category) ?? []), p]);
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  const categories = [...grouped.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "fr"));
  const allCategories = [...new Set([...CATEGORY_ORDER, ...categories])];

  return (
    <>
      <PageHead title="Personnes" sub="Le groupe, l'équipe AlgoLab et les partenaires, avec leurs coordonnées." />

      {categories.map((c) => (
        <section key={c} className="card">
          <div className="card-head">
            <h2>{c}</h2>
            <span className="meta">{grouped.get(c)!.length}</span>
          </div>
          <ul className="people">
            {grouped.get(c)!.map((p) => (
              <li key={p.id}>
                <div className="person-main">
                  <strong>{p.name}</strong>
                  {p.role && <span className="meta">{p.role}</span>}
                  <span className="contacts">
                    {p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
                    {!p.email && !p.linkedin && <span className="meta">Coordonnées à ajouter</span>}
                  </span>
                </div>
                <div className="person-actions">
                  {p.email && (
                    <a className="btn small primary" href={`mailto:${p.email}`}>
                      Contacter
                    </a>
                  )}
                  {p.linkedin && (
                    <a className="btn small" href={p.linkedin} target="_blank" rel="noreferrer">
                      {p.email ? "LinkedIn" : "Contacter sur LinkedIn"}
                    </a>
                  )}
                </div>
                <details className="edit">
                  <summary>Modifier</summary>
                  <PersonForm p={p} categories={allCategories} />
                  <form action={deletePerson} className="danger-zone">
                    <Hidden name="id" value={p.id} />
                    <button type="submit" className="link-btn danger">
                      Supprimer cette personne
                    </button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <details className="card add-card">
        <summary>Ajouter une personne</summary>
        <PersonForm categories={allCategories} />
      </details>
    </>
  );
}
