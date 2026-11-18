import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=oauth`);

  const sb = await createClient();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=oauth`);

  if (!isAllowedEmail(data.user?.email)) {
    await sb.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }
  return NextResponse.redirect(`${origin}/`);
}
