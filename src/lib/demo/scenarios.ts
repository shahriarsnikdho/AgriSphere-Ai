/** Shared (client + server) list of demo scenarios. DEMO ONLY. */
export const DEMO_SCENARIOS = [
  "blast_ok",
  "blast_high",
  "low_confidence",
  "unknown_disease",
  "poor_image",
  "provider_down",
  "invalid_output",
] as const;

export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export const DEMO_SCENARIO_LABELS: Record<DemoScenario, string> = {
  blast_ok: "Rice Leaf Blast - moderate (normal flow)",
  blast_high: "Rice Leaf Blast - high severity (triggers alert)",
  low_confidence: "Low confidence prediction",
  unknown_disease: "Unknown disease",
  poor_image: "Poor image quality",
  provider_down: "AI provider unavailable",
  invalid_output: "Malformed provider output (validation catches it)",
};

export function isDemoScenario(v: unknown): v is DemoScenario {
  return typeof v === "string" && (DEMO_SCENARIOS as readonly string[]).includes(v);
}
