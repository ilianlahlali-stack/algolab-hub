import { signOut } from "@/app/actions";
import { NavLinks } from "@/components/nav";
import { displayName, requireMember } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireMember();
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="eyebrow">Sciences Po · AlgoLab</span>
          <strong>Ministères sociaux</strong>
          <span className="meta">VisuDSN · 2026-2027</span>
        </div>
        <NavLinks />
        <div className="side-foot">
          <span>{displayName(user.email)}</span>
          <form action={signOut}>
            <button type="submit" className="link-btn">
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <form action="/recherche" role="search" className="search">
            <label htmlFor="q" className="sr-only">
              Rechercher un document, une personne, une date…
            </label>
            <input id="q" name="q" type="search" placeholder="Rechercher un document, une personne, une date…" autoComplete="off" />
            <button type="submit" className="btn">
              Rechercher
            </button>
          </form>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
