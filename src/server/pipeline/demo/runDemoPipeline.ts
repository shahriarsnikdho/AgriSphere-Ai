/**
 * DEMO pipeline: image quality -> provider -> validation -> recommendation -> risk -> alerts.
 * Uses the REAL contracts and validation helpers. Recommendation/risk/alert rules here are
 * simple placeholders; Samia owns the real ones (src/server/recommendation, src/server/risk).
 */
import { randomUUID } from "node:crypto";
import {
  DISCLAIMER_BN,
  DiagnoseResponseSchema,
  deriveStatus,
  validateImageQuality,
  validateProviderOutput,
  type Alert,
  type ApiError,
  type DiagnoseResponse,
  type DiagnosisResult,
  type RecommendationResult,
  type RiskResult,
} from "@/contracts";
import type { DemoScenario } from "@/lib/demo/scenarios";
import { MockDiagnosisProvider, mockImageQuality } from "./mockProvider";

type ErrorCode = ApiError["error"]["code"];
export type PipelineResult =
  | { ok: true; data: DiagnoseResponse }
  | { ok: false; httpStatus: number; error: ApiError };

const HTTP: Partial<Record<ErrorCode, number>> = {
  provider_unavailable: 503,
  invalid_provider_response: 502,
  internal_error: 500,
};

function fail(code: ErrorCode, message: string): PipelineResult {
  return { ok: false, httpStatus: HTTP[code] ?? 500, error: { error: { code, message } } };
}

const DEMO_BLAST_RECOMMENDATION: RecommendationResult = {
  recommendationRef: "demo_rice_leaf_blast",
  titleBn: "ধানের ব্লাস্ট রোগের প্রাথমিক করণীয় (ডেমো)",
  stepsBn: [
    "আক্রান্ত পাতা বা গাছ আলাদা করুন, যাতে রোগ ছড়াতে না পারে।",
    "জমিতে অতিরিক্ত ইউরিয়া (নাইট্রোজেন) সার দেওয়া থেকে বিরত থাকুন।",
    "জমিতে পানি ব্যবস্থাপনা ঠিক রাখুন এবং অতিরিক্ত আর্দ্রতা এড়ান।",
    "রোগ বাড়তে থাকলে ছত্রাকনাশক ব্যবহারের আগে স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।",
  ],
  safetyNotesBn: [
    "কোনো ওষুধ বা রাসায়নিক ব্যবহারের আগে লেবেলের নির্দেশনা ও কৃষি কর্মকর্তার পরামর্শ অনুসরণ করুন।",
    "এটি ডেমো পরামর্শ; এখনো বিশেষজ্ঞ বা সেফটি ভ্যালিডেটর দ্বারা যাচাই করা হয়নি।",
  ],
  validated: false, // honest: Samia's safety validator does not exist yet
};

function assess(d: Pick<DiagnosisResult, "status" | "severity">): { risk: RiskResult; kinds: Alert["type"][] } {
  if (d.status === "ok" && d.severity === "high")
    return { risk: { level: "high", reasons: ["High severity"], followUpInDays: 2 }, kinds: ["high_severity", "follow_up"] };
  if (d.status === "ok")
    return { risk: { level: "moderate", reasons: ["Moderate severity"], followUpInDays: 5 }, kinds: ["follow_up"] };
  return {
    risk: { level: "moderate", reasons: ["Result not reliable enough to assess risk; retake photo or consult an officer"] },
    kinds: d.status === "provider_unavailable" ? [] : ["low_confidence"],
  };
}

const ALERT_TEXT: Record<Alert["type"], (days?: number) => string> = {
  high_severity: () => "রোগের তীব্রতা বেশি। দ্রুত স্থানীয় কৃষি কর্মকর্তার সাথে যোগাযোগ করুন।",
  low_confidence: () => "অনুমান নিশ্চিত নয়। পরিষ্কার আলোতে পাতার আরও একটি ছবি তুলুন।",
  follow_up: (n) => `${n ?? 3} দিন পর আবার পাতা পরীক্ষা করুন।`,
  weather_risk: () => "আবহাওয়া ঝুঁকি (ডেমোতে নেই)।",
};

export async function runDemoPipeline(input: {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  scenario: DemoScenario;
}): Promise<PipelineResult> {
  const now = new Date().toISOString();
  const id = `demo_${randomUUID()}`;

  const q = validateImageQuality(mockImageQuality(input.scenario));
  if (!q.success) return fail("internal_error", "Image quality check failed.");
  const imageQuality = q.data;

  const common = { id, imagePath: "demo/not-stored", source: "mock_demo" as const, imageQuality, disclaimer: DISCLAIMER_BN, createdAt: now };
  let diagnosis: DiagnosisResult;

  if (imageQuality.level === "poor") {
    // Do not spend inference on an unusable image.
    diagnosis = { ...common, status: "poor_image", crop: "unknown", disease: "unknown", confidence: 0, severity: "unknown", symptoms: [], modelVersion: "mock-demo-0" };
  } else {
    const provider = new MockDiagnosisProvider(input.scenario);
    let raw: unknown;
    try {
      raw = await provider.diagnose();
    } catch {
      return fail("provider_unavailable", "The diagnosis service is unavailable. Please try again later.");
    }
    const v = validateProviderOutput(raw);
    if (!v.ok) return fail("invalid_provider_response", "The diagnosis service returned an invalid response.");
    const o = v.output;
    const status = deriveStatus({ imageQualityLevel: imageQuality.level, disease: o.disease, confidence: o.confidence });
    diagnosis = {
      ...common,
      status,
      crop: o.crop,
      disease: o.disease,
      confidence: o.confidence,
      severity: o.severity,
      symptoms: o.symptoms,
      earlyDetection: o.earlyDetection,
      recommendationRef: status === "ok" ? DEMO_BLAST_RECOMMENDATION.recommendationRef : undefined,
      modelVersion: o.modelVersion,
    };
  }

  const recommendation = diagnosis.status === "ok" ? DEMO_BLAST_RECOMMENDATION : null;
  const { risk, kinds } = assess(diagnosis);
  const alerts: Alert[] = kinds.map((type, i) => ({
    id: `${id}_a${i}`,
    diagnosisId: id,
    type,
    messageBn: ALERT_TEXT[type](risk.followUpInDays),
    createdAt: now,
  }));

  const parsed = DiagnoseResponseSchema.safeParse({ diagnosis, recommendation, risk, alerts });
  if (!parsed.success) return fail("internal_error", "Could not build a valid result.");
  return { ok: true, data: parsed.data };
}
