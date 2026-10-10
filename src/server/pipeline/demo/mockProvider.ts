/**
 * DEMO ONLY. Returns canned data and NEVER analyses the uploaded image.
 * Real providers (Joy) implement the same DiagnosisProvider interface.
 */
import type { DiagnosisProvider, ImageQualityResult } from "@/contracts";
import type { DemoScenario } from "@/lib/demo/scenarios";

export function mockImageQuality(s: DemoScenario): ImageQualityResult {
  if (s === "poor_image")
    return {
      level: "poor",
      score: 0.18,
      issues: ["blur", "dark"],
      explanationBn: "ছবিটি ঝাপসা ও অন্ধকার। ভালো আলোতে পাতার কাছ থেকে আবার ছবি তুলুন।",
      explanationEn: "Image is blurry and dark. Retake the photo in good light, close to the leaf.",
    };
  return {
    level: "good",
    score: 0.88,
    issues: [],
    explanationBn: "ছবি পরিষ্কার এবং পাতা স্পষ্ট দেখা যাচ্ছে।",
    explanationEn: "Image is sharp and the leaf is clearly visible.",
  };
}

export class MockDiagnosisProvider implements DiagnosisProvider {
  readonly name = "mock-demo";
  readonly source = "mock_demo" as const;
  constructor(private readonly scenario: DemoScenario) {}

  async diagnose(): Promise<unknown> {
    const base = {
      crop: "rice",
      symptoms: ["spindle-shaped lesions with grey centres"],
      modelVersion: "mock-demo-0",
    };
    switch (this.scenario) {
      case "blast_ok":
        return { ...base, disease: "rice_leaf_blast", confidence: 0.82, severity: "moderate", earlyDetection: { isEarlyStage: true } };
      case "blast_high":
        return { ...base, disease: "rice_leaf_blast", confidence: 0.91, severity: "high" };
      case "low_confidence":
        return { ...base, disease: "rice_leaf_blast", confidence: 0.41, severity: "low" };
      case "unknown_disease":
        return { ...base, disease: "unknown", confidence: 0.35, severity: "unknown", symptoms: [] };
      case "provider_down":
        throw new Error("mock provider unavailable");
      case "invalid_output":
        // percentage instead of 0..1, and wrong enum: must be rejected by validation
        return { ...base, disease: "Rice Leaf Blast", confidence: 82, severity: "critical" };
      default:
        return { ...base, disease: "rice_leaf_blast", confidence: 0.8, severity: "low" };
    }
  }
}
