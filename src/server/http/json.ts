import "server-only";
import { err, ok, type Result } from "@/domain/shared/result";

export async function readJsonBody(request: Request): Promise<Result<unknown, "BODY_INVALID_JSON">> {
  try {
    const body = await request.json();
    return ok(body);
  } catch {
    return err("BODY_INVALID_JSON");
  }
}

export function json(body: unknown, status: number): Response {
  return Response.json(body, { status });
}
