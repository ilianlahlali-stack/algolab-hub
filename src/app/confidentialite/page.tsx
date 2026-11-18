import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confidentialité · AlgoLab hub",
};

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function Confidentialite() {
  return (
    <main className="login">
      <div className="login-card" style={{ maxWidth: 720 }}>
        <div className="eyebrow">Sciences Po · AlgoLab 2026-2027</div>
        <h1>Règles de confidentialité</h1>
        <p className="muted">
          AlgoLab hub est un espace de travail privé du groupe « Ministères sociaux » (projet VisuDSN), réservé aux comptes
          @sciencespo.fr. Il n&apos;est pas ouvert au public et ne sert à aucun usage commercial.
        </p>

        <div className="md">
          <h4>Données enregistrées</h4>
          <ul>
            <li>Ton adresse e-mail Sciences Po et ton nom, fournis par la connexion Google, pour t&apos;identifier.</li>
            <li>Le contenu que le groupe saisit : tâches, fiches, notes, liens et dates du calendrier.</li>
          </ul>

          <h4>Accès à Google Drive</h4>
          <ul>
            <li>
              L&apos;app lit uniquement les métadonnées des dossiers Drive que le groupe a choisi de surveiller (nom, date de modification,
              auteur) pour afficher un fil d&apos;activité. Le contenu de ces fichiers n&apos;est pas lu.
            </li>
            <li>
              L&apos;app crée et modifie uniquement les Google Docs qu&apos;elle a elle-même créés pour les fiches. Elle ne lit, ne modifie et ne
              supprime aucun autre document de ton Drive.
            </li>
          </ul>

          <h4>Partage et conservation</h4>
          <ul>
            <li>Les données ne sont ni vendues ni transmises à des tiers, en dehors des services qui hébergent l&apos;app (Supabase et Vercel).</li>
            <li>Les données sont visibles uniquement par les membres connectés avec une adresse @sciencespo.fr.</li>
            <li>Elles sont conservées le temps du projet AlgoLab, puis supprimées sur simple demande.</li>
          </ul>

          <h4>Contact</h4>
          <p>
            {contact ? (
              <>
                Pour toute question ou demande de suppression, écris à <a href={`mailto:${contact}`}>{contact}</a>.
              </>
            ) : (
              "Pour toute question ou demande de suppression, contacte le responsable du projet au sein du groupe."
            )}
          </p>
        </div>

        <Link href="/login" className="link-btn">
          Retour à la connexion
        </Link>
      </div>
    </main>
  );
}
