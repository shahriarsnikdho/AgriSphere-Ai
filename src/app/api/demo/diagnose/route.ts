/**
 * DEMO endpoint. NOT the production /api/diagnose:
 *  - no authentication, no persistence, image is validated but NOT analysed or stored
 *  - must be deleted (or gated) once Supabase auth exists
 */
import { NextResponse } from "next/server";
import type { ApiError } from "@/contracts";
import { isDemoScenario } from "@/lib/demo/scenarios";
import { checkUploadBytes, checkUploadMeta } from "@/server/pipeline/demo/imageCheck";
import { runDemoPipeline } from "@/server/pipeline/demo/runDemoPipeline";

const STATUS = { invalid_request: 400, unsupported_media_type: 415, payload_too_large: 413 } as const;

function err(code: keyof typeof STATUS, message: string) {
  const body: ApiError = { error: { code, message } };
  return NextResponse.json(body, { status: STATUS[code] });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return err("invalid_request", "Invalid form data.");
  }
  const file = form.get("image");
  if (!(file instanceof File)) return err("invalid_request", "Missing image file.");

  const scenario = form.get("scenario") ?? "blast_ok";
  if (!isDemoScenario(scenario)) return err("invalid_request", "Unknown demo scenario.");

  const meta = checkUploadMeta({ size: file.size, declaredType: file.type });
  if (!meta.ok) return err(meta.code, meta.message);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = checkUploadBytes(bytes);
  if (!sniffed.ok) return err(sniffed.code, sniffed.message);

  const result = await runDemoPipeline({ bytes, mimeType: sniffed.mime, scenario });
  if (!result.ok) return NextResponse.json(result.error, { status: result.httpStatus });
  return NextResponse.json(result.data);
}
