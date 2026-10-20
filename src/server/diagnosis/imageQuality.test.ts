/**
 * Synthetic-image tests. They prove the decision logic and the contract shape.
 * They do NOT validate the thresholds on real leaf photos (see imageQuality.ts header).
 */
import sharp, { type Sharp } from "sharp";
import { describe, expect, it } from "vitest";
import { validateImageQuality } from "@/contracts";
import { assess, measureImage, SharpImageQualityChecker, THRESHOLDS } from "./imageQuality";

// Small seeded PRNG so images (and therefore tests) are deterministic.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type RGB = [number, number, number];
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Textured scene: soil-coloured background with a leaf-coloured ellipse and vein stripes. */
function scene(opts: { w: number; h: number; bg: RGB; leaf: RGB | null; seed?: number }) {
  const { w, h, bg, leaf } = opts;
  const rand = rng(opts.seed ?? 1);
  const buf = Buffer.alloc(w * h * 3);
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = leaf !== null && ((x - cx) / (w * 0.4)) ** 2 + ((y - cy) / (h * 0.4)) ** 2 < 1;
      const base = inside ? (leaf as RGB) : bg;
      const vein = inside && Math.floor((x + y) / 6) % 5 === 0 ? -25 : 0;
      const noise = (rand() - 0.5) * 70;
      const p = (y * w + x) * 3;
      buf[p] = clamp(base[0] + vein + noise);
      buf[p + 1] = clamp(base[1] + vein + noise);
      buf[p + 2] = clamp(base[2] + vein + noise);
    }
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } });
}

const SOIL: RGB = [120, 95, 70];
const GREEN: RGB = [70, 140, 55];
const SKY: RGB = [150, 165, 190];

const jpeg = (img: Sharp) => img.jpeg({ quality: 90 }).toBuffer().then((b) => new Uint8Array(b));
const checker = new SharpImageQualityChecker();
const run = (bytes: Uint8Array) => checker.check({ imageBytes: bytes, mimeType: "image/jpeg" });

describe("image quality checker", () => {
  it("accepts a sharp, well-lit leaf photo and satisfies the contract", async () => {
    const r = await run(await jpeg(scene({ w: 640, h: 480, bg: SOIL, leaf: GREEN })));
    expect(validateImageQuality(r).success).toBe(true);
    expect(r.level).toBe("good");
    expect(r.issues).toEqual([]);
    expect(r.score).toBe(1);
  });

  it("flags a blurred photo as poor with the blur issue", async () => {
    const r = await run(await jpeg(scene({ w: 640, h: 480, bg: SOIL, leaf: GREEN }).blur(9)));
    expect(r.level).toBe("poor");
    expect(r.issues).toContain("blur");
    expect(validateImageQuality(r).success).toBe(true);
  });

  it("flags a very dark photo as poor with the dark issue", async () => {
    const r = await run(await jpeg(scene({ w: 640, h: 480, bg: SOIL, leaf: GREEN }).linear(0.12, 0)));
    expect(r.level).toBe("poor");
    expect(r.issues).toContain("dark");
  });

  it("flags an overexposed photo as poor with the overexposed issue", async () => {
    const r = await run(await jpeg(scene({ w: 640, h: 480, bg: SOIL, leaf: GREEN }).linear(1, 150)));
    expect(r.level).toBe("poor");
    expect(r.issues).toContain("overexposed");
  });

  it("flags a frame with no leaf-coloured area", async () => {
    const r = await run(await jpeg(scene({ w: 640, h: 480, bg: SKY, leaf: null })));
    expect(r.level).toBe("poor");
    expect(r.issues).toContain("no_leaf");
  });

  it("flags a tiny image", async () => {
    const r = await run(await jpeg(scene({ w: 96, h: 72, bg: SOIL, leaf: GREEN })));
    expect(r.level).toBe("poor");
    expect(r.issues).toContain("too_small");
  });

  it("reports several issues together in the Bangla and English text", async () => {
    const r = await run(await jpeg(scene({ w: 640, h: 480, bg: SOIL, leaf: GREEN }).blur(9).linear(0.12, 0)));
    expect(r.issues).toEqual(expect.arrayContaining(["blur", "dark"]));
    expect(r.explanationBn).toContain("ঝাপসা");
    expect(r.explanationBn).toContain("অন্ধকার");
    expect(r.explanationEn).toContain("blurry");
    expect(r.explanationEn).toContain("too dark");
  });

  it("returns a safe poor result for bytes that are not a decodable image", async () => {
    const r = await run(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]));
    expect(r.level).toBe("poor");
    expect(r.score).toBe(0);
    expect(r.issues).toEqual([]);
    expect(validateImageQuality(r).success).toBe(true);
  });

  it("is deterministic for the same bytes", async () => {
    const bytes = await jpeg(scene({ w: 640, h: 480, bg: SOIL, leaf: GREEN }));
    expect(await run(bytes)).toEqual(await run(bytes));
  });

  it("works on PNG and WebP as well as JPEG", async () => {
    const img = scene({ w: 640, h: 480, bg: SOIL, leaf: GREEN });
    const png = new Uint8Array(await img.clone().png().toBuffer());
    const webp = new Uint8Array(await img.clone().webp({ quality: 90 }).toBuffer());
    expect((await checker.check({ imageBytes: png, mimeType: "image/png" })).level).toBe("good");
    expect((await checker.check({ imageBytes: webp, mimeType: "image/webp" })).level).toBe("good");
  });

  it("respects EXIF-independent size: minSide uses the shorter side", async () => {
    const m = await measureImage(await jpeg(scene({ w: 800, h: 150, bg: SOIL, leaf: GREEN })));
    expect(m.minSide).toBe(150);
    expect(m.minSide).toBeLessThan(THRESHOLDS.minSide.hard);
  });
});

describe("assess() decision rules", () => {
  const ok = { width: 1000, height: 800, minSide: 800, meanLuminance: 120, sharpness: 400, leafFraction: 0.5 };

  it("good when every metric is past its soft threshold", () => {
    expect(assess(ok)).toMatchObject({ level: "good", issues: [], score: 1 });
  });

  it("acceptable (not poor) between the hard and soft thresholds", () => {
    const r = assess({ ...ok, sharpness: 60 });
    expect(r.level).toBe("acceptable");
    expect(r.issues).toEqual(["blur"]);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(1);
  });

  it("poor as soon as one metric reaches its hard threshold", () => {
    const r = assess({ ...ok, leafFraction: THRESHOLDS.leafFraction.hard });
    expect(r.level).toBe("poor");
    expect(r.issues).toEqual(["no_leaf"]);
    expect(r.score).toBe(0);
  });
});
