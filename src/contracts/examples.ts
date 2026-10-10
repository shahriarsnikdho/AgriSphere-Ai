/** Example payloads used by tests and docs/INTEGRATION.md. Demo data only. */
import { DISCLAIMER_EN } from "./pipeline";

export const validImageQuality = {
  level: "good",
  score: 0.88,
  issues: [],
  explanationBn: "ছবি পরিষ্কার এবং পাতা স্পষ্ট দেখা যাচ্ছে।",
  explanationEn: "Image is sharp and the leaf is clearly visible.",
};

export const validDiagnosis = {
  id: "diag_demo_001",
  imagePath: "diagnosis-images/user_demo/diag_demo_001.jpg",
  status: "ok",
  source: "mock_demo",
  crop: "rice",
  disease: "rice_leaf_blast",
  confidence: 0.82,
  severity: "moderate",
  imageQuality: validImageQuality,
  symptoms: ["spindle-shaped lesions with grey centres"],
  earlyDetection: { isEarlyStage: true },
  recommendationRef: "rice_leaf_blast_v1",
  disclaimer: DISCLAIMER_EN,
  modelVersion: "mock-0",
  createdAt: "2026-10-10T12:00:00+06:00",
};

/** Invalid on purpose: percentage instead of 0..1, severity key mixed in confidence. */
export const invalidDiagnosisPercentConfidence = { ...validDiagnosis, confidence: 82 };
