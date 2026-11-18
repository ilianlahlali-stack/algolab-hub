import { signInWithGoogle } from "@/app/actions";
import { ALLOWED_DOMAIN } from "@/lib/auth";

const ERRORS: Record<string, string> = {
  domain: `Ce compte n'est pas autorisé. Connecte-toi avec ton adresse @${ALLOWED_DOMAIN}.`,
  oauth: "La connexion Google n'a pas abouti. Réessaie.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="login">
      <div className="login-card">
        <div className="eyebrow">Sciences Po · AlgoLab 2026-2027</div>
        <h1>AlgoLab · Ministères sociaux</h1>
        <p className="muted">Espace du groupe VisuDSN. Accès réservé aux comptes @{ALLOWED_DOMAIN}.</p>
        {message && <p className="alert">{message}</p>}
        <form action={signInWithGoogle}>
          <button type="submit" className="btn primary wide">
            Se connecter avec Google
          </button>
        </form>
      </div>
    </main>
  );
}
