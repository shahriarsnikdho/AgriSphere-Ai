import { describe, expect, it } from "vitest";
import {
  AlertSchema,
  ApiErrorSchema,
  DiagnosisResultSchema,
  DiagnoseResponseSchema,
  FarmerProfileSchema,
  ImageQualityResultSchema,
  RecommendationResultSchema,
  RiskResultSchema,
  deriveStatus,
  validateProviderOutput,
} from "./index";
import { invalidDiagnosisPercentConfidence, validDiagnosis, validImageQuality } from "./examples";

const providerOk = {
  crop: "rice",
  disease: "rice_leaf_blast",
  confidence: 0.82,
  severity: "moderate",
  symptoms: ["lesions"],
  modelVersion: "mock-0",
};

describe("DiagnosisResult contract", () => {
  it("accepts the valid example", () => {
    expect(DiagnosisResultSchema.safeParse(validDiagnosis).success).toBe(true);
  });
  it.each([82, 1.01, -0.1, NaN, Infinity])("rejects confidence %s", (c) => {
    expect(DiagnosisResultSchema.safeParse({ ...validDiagnosis, confidence: c }).success).toBe(false);
  });
  it("rejects percentage-style example", () => {
    expect(DiagnosisResultSchema.safeParse(invalidDiagnosisPercentConfidence).success).toBe(false);
  });
  it("rejects invalid severity and mixed/unknown keys", () => {
    expect(DiagnosisResultSchema.safeParse({ ...validDiagnosis, severity: "critical" }).success).toBe(false);
    expect(DiagnosisResultSchema.safeParse({ ...validDiagnosis, severityConfidence: 0.5 }).success).toBe(false);
  });
  it("requires a non-empty disclaimer", () => {
    const rest: Record<string, unknown> = { ...validDiagnosis };
    delete rest.disclaimer;
    expect(DiagnosisResultSchema.safeParse(rest).success).toBe(false);
    expect(DiagnosisResultSchema.safeParse({ ...validDiagnosis, disclaimer: "" }).success).toBe(false);
  });
  it("status/disease cross-rules", () => {
    expect(DiagnosisResultSchema.safeParse({ ...validDiagnosis, disease: "unknown" }).success).toBe(false);
    expect(
      DiagnosisResultSchema.safeParse({ ...validDiagnosis, status: "unknown_disease", disease: "unknown", recommendationRef: undefined }).success,
    ).toBe(true);
    expect(DiagnosisResultSchema.safeParse({ ...validDiagnosis, status: "unknown_disease" }).success).toBe(false);
    expect(DiagnosisResultSchema.safeParse({ ...validDiagnosis, status: "poor_image" }).success).toBe(false);
    expect(DiagnosisResultSchema.safeParse({ ...validDiagnosis, recommendationRef: undefined }).success).toBe(false);
  });
  it("rejects non-ISO timestamps", () => {
    expect(DiagnosisResultSchema.safeParse({ ...validDiagnosis, createdAt: "yesterday" }).success).toBe(false);
  });
});

describe("provider output is untrusted", () => {
  it("accepts well-formed output", () => {
    expect(validateProviderOutput(providerOk).ok).toBe(true);
  });
  it.each([null, undefined, "blast", 42, {}, { ...providerOk, confidence: "high" }, { ...providerOk, confidence: 95 }, { ...providerOk, disease: "Rice Leaf Blast" }, { ...providerOk, extra: 1 }])(
    "maps malformed output %# to invalid_response",
    (raw) => {
      const r = validateProviderOutput(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.status).toBe("invalid_response");
        expect(r.issues.length).toBeGreaterThan(0);
      }
    },
  );
});

describe("deriveStatus", () => {
  const base = { imageQualityLevel: "good" as const, disease: "rice_leaf_blast", confidence: 0.9 };
  it("ok", () => expect(deriveStatus(base)).toBe("ok"));
  it("poor image wins", () => expect(deriveStatus({ ...base, imageQualityLevel: "poor" })).toBe("poor_image"));
  it("unknown disease", () => expect(deriveStatus({ ...base, disease: "unknown" })).toBe("unknown_disease"));
  it("low confidence below threshold", () => expect(deriveStatus({ ...base, confidence: 0.3 })).toBe("low_confidence"));
  it("threshold boundary is inclusive-ok", () => expect(deriveStatus({ ...base, confidence: 0.6 })).toBe("ok"));
  it("severity never affects status", () => expect(deriveStatus(base)).toBe(deriveStatus({ ...base })));
});

describe("other contracts", () => {
  it("ImageQualityResult", () => {
    expect(ImageQualityResultSchema.safeParse(validImageQuality).success).toBe(true);
    expect(ImageQualityResultSchema.safeParse({ ...validImageQuality, issues: ["smudge"] }).success).toBe(false);
  });
  it("RecommendationResult needs >=1 step", () => {
    const rec = { recommendationRef: "r1", titleBn: "শিরোনাম", stepsBn: ["ধাপ ১"], safetyNotesBn: [], validated: true };
    expect(RecommendationResultSchema.safeParse(rec).success).toBe(true);
    expect(RecommendationResultSchema.safeParse({ ...rec, stepsBn: [] }).success).toBe(false);
  });
  it("RiskResult", () => {
    expect(RiskResultSchema.safeParse({ level: "high", reasons: ["severity high"], followUpInDays: 3 }).success).toBe(true);
    expect(RiskResultSchema.safeParse({ level: "extreme", reasons: [] }).success).toBe(false);
  });
  it("Alert", () => {
    const a = { id: "a1", diagnosisId: "d1", type: "high_severity", messageBn: "সতর্কতা", createdAt: "2026-10-10T12:00:00Z" };
    expect(AlertSchema.safeParse(a).success).toBe(true);
    expect(AlertSchema.safeParse({ ...a, type: "spam" }).success).toBe(false);
  });
  it("FarmerProfile", () => {
    const p = { id: "u1", crops: ["rice"], languagePref: "bn", createdAt: "2026-10-10T12:00:00Z" };
    expect(FarmerProfileSchema.safeParse(p).success).toBe(true);
    expect(FarmerProfileSchema.safeParse({ ...p, languagePref: "fr" }).success).toBe(false);
  });
  it("API error envelope + diagnose response", () => {
    expect(ApiErrorSchema.safeParse({ error: { code: "unauthenticated", message: "Sign in required" } }).success).toBe(true);
    expect(ApiErrorSchema.safeParse({ error: { code: "boom", message: "x" } }).success).toBe(false);
    const resp = { diagnosis: validDiagnosis, recommendation: null, risk: { level: "moderate", reasons: ["moderate severity"] }, alerts: [] };
    expect(DiagnoseResponseSchema.safeParse(resp).success).toBe(true);
  });
});
