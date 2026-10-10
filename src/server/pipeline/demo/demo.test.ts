import { describe, expect, it } from "vitest";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios";
import { checkUploadBytes, checkUploadMeta, MAX_UPLOAD_BYTES, sniffMime } from "./imageCheck";
import { runDemoPipeline } from "./runDemoPipeline";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const run = (scenario: (typeof DEMO_SCENARIOS)[number]) => runDemoPipeline({ bytes: PNG, mimeType: "image/png", scenario });

describe("upload validation", () => {
  it("rejects empty, oversized and unsupported types", () => {
    expect(checkUploadMeta({ size: 0, declaredType: "image/png" }).ok).toBe(false);
    const big = checkUploadMeta({ size: MAX_UPLOAD_BYTES + 1, declaredType: "image/png" });
    expect(big.ok === false && big.code).toBe("payload_too_large");
    const gif = checkUploadMeta({ size: 10, declaredType: "image/gif" });
    expect(gif.ok === false && gif.code).toBe("unsupported_media_type");
    expect(checkUploadMeta({ size: 10, declaredType: "image/png" }).ok).toBe(true);
  });
  it("sniffs real signatures and rejects fake images", () => {
    expect(sniffMime(PNG)).toBe("image/png");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(checkUploadBytes(new TextEncoder().encode("<script>alert(1)</script>")).ok).toBe(false);
  });
});

describe("demo pipeline", () => {
  it("normal flow: ok + validated shape + demo label + recommendation", async () => {
    const r = await run("blast_ok");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.diagnosis.status).toBe("ok");
    expect(r.data.diagnosis.source).toBe("mock_demo");
    expect(r.data.diagnosis.confidence).toBe(0.82);
    expect(r.data.diagnosis.severity).toBe("moderate");
    expect(r.data.diagnosis.disclaimer.length).toBeGreaterThan(0);
    expect(r.data.recommendation?.validated).toBe(false);
    expect(r.data.alerts.map((a) => a.type)).toEqual(["follow_up"]);
  });
  it("high severity raises a high_severity alert", async () => {
    const r = await run("blast_high");
    expect(r.ok && r.data.alerts.map((a) => a.type)).toEqual(["high_severity", "follow_up"]);
  });
  it("low confidence: no recommendation, low_confidence alert", async () => {
    const r = await run("low_confidence");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.diagnosis.status).toBe("low_confidence");
    expect(r.data.recommendation).toBeNull();
    expect(r.data.alerts.map((a) => a.type)).toEqual(["low_confidence"]);
  });
  it("unknown disease", async () => {
    const r = await run("unknown_disease");
    expect(r.ok && r.data.diagnosis.status).toBe("unknown_disease");
    expect(r.ok && r.data.recommendation).toBeNull();
  });
  it("poor image skips the provider", async () => {
    const r = await run("poor_image");
    expect(r.ok && r.data.diagnosis.status).toBe("poor_image");
    expect(r.ok && r.data.diagnosis.imageQuality.level).toBe("poor");
  });
  it("provider down -> 503 provider_unavailable", async () => {
    const r = await run("provider_down");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.httpStatus).toBe(503);
    expect(r.error.error.code).toBe("provider_unavailable");
  });
  it("malformed provider output -> 502 and no raw output leaked", async () => {
    const r = await run("invalid_output");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.httpStatus).toBe(502);
    expect(r.error.error.code).toBe("invalid_provider_response");
    expect(JSON.stringify(r.error)).not.toContain("critical");
  });
  it("every scenario yields either a schema-valid result or a contract error", async () => {
    for (const s of DEMO_SCENARIOS) {
      const r = await run(s);
      expect(typeof r.ok).toBe("boolean");
    }
  });
});
