import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const ALLOWED_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN ?? "sciencespo.fr").toLowerCase();

export const isAllowedEmail = (email?: string | null) =>
  !!email && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);

/** Utilisateur connecté avec une adresse autorisée, sinon renvoi vers /login. */
export async function requireMember(): Promise<{ sb: SupabaseClient; user: User }> {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  if (!data.user || !isAllowedEmail(data.user.email)) redirect("/login");
  return { sb, user: data.user };
}

/** « prenom.nom@sciencespo.fr » → « Prenom Nom ». */
export function displayName(email?: string | null): string {
  if (!email) return "";
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
