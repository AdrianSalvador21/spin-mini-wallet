import { redirect } from "next/navigation";
import { getServices } from "@/server/container";
import { getSession } from "@/server/session/session";
import { ROUTES } from "@/shared/lib/routes";

export async function SessionGuard() {
  const session = await getSession();

  if (session && !(await getServices().auth.exists(session.userId))) {
    redirect(ROUTES.SESSION_END);
  }

  return null;
}
