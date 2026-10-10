/**
 * AgriSphere shared contracts. Source of truth = these zod schemas;
 * TypeScript types are inferred from them (see ./index.ts).
 * Owner: Snikdho. Changes require a PR reviewed by every producer/consumer owner.
 *
 * CONVENTIONS
 *  - confidence: number in [0, 1] (NOT a percentage). UI formats as %.
 *  - severity: independent enum. NEVER derived from or mixed with confidence.
 *  - timestamps: ISO 8601 strings with timezone.
 *  - slugs (crop, disease): lowercase snake_case; disease may be "unknown".
 *  - All objects are .strict(): unknown keys are rejected.
 */
import { z } from "zod";

export const CONFIDENCE_CONVENTION = "number in [0,1]" as const;

export const ConfidenceSchema = z.number().finite().min(0).max(1);
export const SeveritySchema = z.enum(["none", "low", "moderate", "high", "unknown"]);
export const DataSourceSchema = z.enum(["live", "mock_demo"]);
export const DiagnosisStatusSchema = z.enum([
  "ok",
  "low_confidence",
  "unknown_disease",
  "poor_image",
  "provider_unavailable",
  "invalid_response",
]);
export const ImageQualityLevelSchema = z.enum(["good", "acceptable", "poor"]);
export const ImageIssueSchema = z.enum(["blur", "dark", "overexposed", "no_leaf", "too_small"]);

const Slug = z.string().regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, "must be lowercase snake_case");
const IsoDate = z.iso.datetime({ offset: true });

export const ImageQualityResultSchema = z
  .object({
    level: ImageQualityLevelSchema,
    score: ConfidenceSchema, // 0..1 quality score (same numeric range, different meaning)
    issues: z.array(ImageIssueSchema),
    explanationBn: z.string().min(1),
    explanationEn: z.string().min(1),
  })
  .strict();

/** What a diagnosis PROVIDER (Joy) returns. Pipeline adds id/imagePath/etc. */
export const ProviderOutputSchema = z
  .object({
    crop: Slug,
    disease: z.union([Slug, z.literal("unknown")]),
    confidence: ConfidenceSchema,
    severity: SeveritySchema,
    symptoms: z.array(z.string().min(1)).max(20),
    earlyDetection: z
      .object({ isEarlyStage: z.boolean(), notes: z.string().optional() })
      .strict()
      .optional(),
    modelVersion: z.string().min(1),
  })
  .strict();

/** The validated, persisted, UI-facing diagnosis. */
export const DiagnosisResultSchema = z
  .object({
    id: z.string().min(1),
    imagePath: z.string().min(1), // private storage path, never a public URL
    status: DiagnosisStatusSchema,
    source: DataSourceSchema,
    crop: Slug,
    disease: z.union([Slug, z.literal("unknown")]),
    confidence: ConfidenceSchema,
    severity: SeveritySchema,
    imageQuality: ImageQualityResultSchema,
    symptoms: z.array(z.string().min(1)).max(20),
    earlyDetection: z
      .object({ isEarlyStage: z.boolean(), notes: z.string().optional() })
      .strict()
      .optional(),
    recommendationRef: z.string().min(1).optional(),
    disclaimer: z.string().min(1), // REQUIRED, always shown
    modelVersion: z.string().min(1),
    createdAt: IsoDate,
  })
  .strict()
  .superRefine((d, ctx) => {
    const bad = (message: string, path: string[]) =>
      ctx.addIssue({ code: "custom", message, path });
    if (d.status === "ok" && d.disease === "unknown")
      bad("status 'ok' requires a known disease", ["disease"]);
    if (d.status === "unknown_disease" && d.disease !== "unknown")
      bad("status 'unknown_disease' requires disease 'unknown'", ["disease"]);
    if (d.status === "poor_image" && d.imageQuality.level !== "poor")
      bad("status 'poor_image' requires imageQuality.level 'poor'", ["imageQuality", "level"]);
    if (d.status === "ok" && !d.recommendationRef)
      bad("status 'ok' requires recommendationRef", ["recommendationRef"]);
  });

export const RecommendationResultSchema = z
  .object({
    recommendationRef: z.string().min(1),
    titleBn: z.string().min(1),
    stepsBn: z.array(z.string().min(1)).min(1),
    safetyNotesBn: z.array(z.string().min(1)),
    validated: z.boolean(), // set ONLY by the safety validator (Samia)
    blockedReasons: z.array(z.string()).optional(),
  })
  .strict();

export const RiskResultSchema = z
  .object({
    level: z.enum(["low", "moderate", "high"]),
    reasons: z.array(z.string().min(1)),
    followUpInDays: z.number().int().min(1).max(60).optional(),
  })
  .strict();

export const AlertSchema = z
  .object({
    id: z.string().min(1),
    diagnosisId: z.string().min(1),
    type: z.enum(["high_severity", "low_confidence", "follow_up", "weather_risk"]),
    messageBn: z.string().min(1),
    createdAt: IsoDate,
    dismissedAt: IsoDate.optional(),
  })
  .strict();

export const FarmerProfileSchema = z
  .object({
    id: z.string().min(1), // = Supabase auth.users.id
    displayName: z.string().min(1).max(100).optional(),
    district: z.string().min(1).max(100).optional(),
    crops: z.array(Slug),
    languagePref: z.enum(["bn", "en"]),
    createdAt: IsoDate,
  })
  .strict();

// ---- API envelope -------------------------------------------------------

export const ApiErrorCodeSchema = z.enum([
  "unauthenticated",
  "not_found",
  "invalid_request",
  "unsupported_media_type",
  "payload_too_large",
  "poor_image",
  "provider_unavailable",
  "invalid_provider_response",
  "rate_limited",
  "internal_error",
]);

export const ApiErrorSchema = z
  .object({ error: z.object({ code: ApiErrorCodeSchema, message: z.string().min(1) }).strict() })
  .strict();

export const DiagnoseResponseSchema = z
  .object({
    diagnosis: DiagnosisResultSchema,
    recommendation: RecommendationResultSchema.nullable(), // null when no validated advice is allowed
    risk: RiskResultSchema,
    alerts: z.array(AlertSchema),
  })
  .strict();
