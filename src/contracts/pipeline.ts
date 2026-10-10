/**
 * Pure validation helpers owned by Snikdho (pipeline step "diagnosis result validation").
 * No I/O, no provider-specific logic.
 */
import {
  ImageQualityResultSchema,
  ProviderOutputSchema,
  type DiagnosisStatusSchema,
} from "./schemas";
import type { z } from "zod";

type DiagnosisStatus = z.infer<typeof DiagnosisStatusSchema>;

/**
 * PROVISIONAL: must be calibrated by Joy against real evaluation data.
 * Below this, the UI must show "low confidence" and must not present advice as reliable.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

export const DISCLAIMER_EN =
  "This is a preliminary AI estimate, not a confirmed agricultural diagnosis. Consult a local agriculture officer when in doubt.";
// Bangla text is a DRAFT for Samia/Sejda review before production use.
export const DISCLAIMER_BN =
  "এটি একটি প্রাথমিক এআই-ভিত্তিক অনুমান, নিশ্চিত কৃষি রোগ নির্ণয় নয়। সন্দেহ হলে স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।";

export type ProviderValidation =
  | { ok: true; output: z.infer<typeof ProviderOutputSchema> }
  | { ok: false; status: "invalid_response"; issues: string[] };

/** Treat provider output as untrusted. */
export function validateProviderOutput(raw: unknown): ProviderValidation {
  const r = ProviderOutputSchema.safeParse(raw);
  if (r.success) return { ok: true, output: r.data };
  return {
    ok: false,
    status: "invalid_response",
    issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
  };
}

export function validateImageQuality(raw: unknown) {
  return ImageQualityResultSchema.safeParse(raw);
}

/** Deterministic status derivation. Confidence and severity are never combined. */
export function deriveStatus(args: {
  imageQualityLevel: "good" | "acceptable" | "poor";
  disease: string;
  confidence: number;
  threshold?: number;
}): DiagnosisStatus {
  const t = args.threshold ?? LOW_CONFIDENCE_THRESHOLD;
  if (args.imageQualityLevel === "poor") return "poor_image";
  if (args.disease === "unknown") return "unknown_disease";
  if (args.confidence < t) return "low_confidence";
  return "ok";
}
