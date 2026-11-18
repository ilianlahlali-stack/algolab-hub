import { revalidatePath } from "next/cache";
import { syncDrive } from "@/lib/drive";

export const maxDuration = 60;

/** Appelé toutes les 15 min par pg_cron (Supabase), avec « Authorization: Bearer CRON_SECRET ». */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    const summary = await syncDrive();
    revalidatePath("/");
    return Response.json(summary);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
