/**
 * Image quality checker. Owner: Joy.
 * Implements ImageQualityChecker (src/contracts/provider.ts) on the server, from raw bytes.
 *
 * Pure heuristics, no model, no network. Every threshold below is PROVISIONAL: it was set
 * from synthetic images only and MUST be calibrated on real phone photos with measureImage()
 * (see docs/DECISIONS.md #7). Do not report these numbers as validated.
 *
 * Callers still run the upload checks first (size, MIME sniffing: src/server/pipeline/demo/imageCheck.ts).
 */
import sharp from "sharp";
import type { DiagnosisProviderInput, ImageQualityChecker, ImageQualityResult } from "@/contracts";

type Issue = ImageQualityResult["issues"][number];

/** [hard, soft]: at or beyond `hard` the metric fails (poor); between hard and soft it is only acceptable. */
export const THRESHOLDS = {
  /** Shorter image side in px. Lower is worse. */
  minSide: { hard: 160, soft: 224 },
  /** Mean luminance 0..255. Lower is worse (dark). */
  darkMean: { hard: 40, soft: 70 },
  /** Mean luminance 0..255. Higher is worse (overexposed). */
  brightMean: { hard: 225, soft: 200 },
  /** Variance of the Laplacian on a grayscale image of at most WORK_SIDE px. Lower is worse (blur). */
  sharpness: { hard: 30, soft: 100 },
  /** Fraction of leaf-coloured pixels. Lower is worse (no leaf in frame). */
  leafFraction: { hard: 0.05, soft: 0.15 },
} as const;

/** Longest side of the working copy. Sharpness is only comparable at a fixed scale. */
const WORK_SIDE = 512;

export interface ImageMetrics {
  width: number;
  height: number;
  minSide: number;
  meanLuminance: number;
  sharpness: number;
  leafFraction: number;
}

/** Decode once and compute all metrics. Throws if the bytes cannot be decoded as an image. */
export async function measureImage(bytes: Uint8Array): Promise<ImageMetrics> {
  const base = sharp(bytes, { failOn: "error", limitInputPixels: 100_000_000 });
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const { data, info } = await base
    .rotate()
    .resize({ width: WORK_SIDE, height: WORK_SIDE, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const n = w * h;
  const gray = new Float32Array(n);
  let lumSum = 0;
  let leaf = 0;

  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = y;
    lumSum += y;

    // Leaf-coloured: hue 35..170 degrees (yellow-green to green), not grey, not near-black.
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (max >= 38 && d > 0 && d / max >= 0.2) {
      let hue: number;
      if (max === r) hue = ((g - b) / d) % 6;
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
      if (hue >= 35 && hue <= 170) leaf++;
    }
  }

  let lapSum = 0;
  let lapSq = 0;
  let lapN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      lapSum += lap;
      lapSq += lap * lap;
      lapN++;
    }
  }
  const lapMean = lapN ? lapSum / lapN : 0;
  const sharpness = lapN ? lapSq / lapN - lapMean * lapMean : 0;

  return {
    width,
    height,
    minSide: Math.min(width, height),
    meanLuminance: n ? lumSum / n : 0,
    sharpness,
    leafFraction: n ? leaf / n : 0,
  };
}

/** 1 = fine, 0 = failed, linear in between. Works for both "lower is worse" and "higher is worse". */
function ramp(value: number, t: { hard: number; soft: number }): number {
  const q = (value - t.hard) / (t.soft - t.hard);
  return Math.min(1, Math.max(0, q));
}

const BN: Record<Issue, string> = {
  blur: "ঝাপসা",
  dark: "অন্ধকার",
  overexposed: "অতিরিক্ত উজ্জ্বল",
  too_small: "খুব ছোট",
  no_leaf: "",
};
const EN: Record<Issue, string> = {
  blur: "blurry",
  dark: "too dark",
  overexposed: "overexposed",
  too_small: "too small",
  no_leaf: "",
};

function joinBn(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} ও ${parts[parts.length - 1]}`;
}
function joinEn(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Bangla text is a DRAFT for Samia/Sejda to review, same status as DISCLAIMER_BN.
 */
function explain(level: ImageQualityResult["level"], issues: Issue[]): Pick<ImageQualityResult, "explanationBn" | "explanationEn"> {
  if (level === "good") {
    return {
      explanationBn: "ছবি পরিষ্কার এবং পাতা স্পষ্ট দেখা যাচ্ছে।",
      explanationEn: "Image is sharp and the leaf is clearly visible.",
    };
  }
  const adj = issues.filter((i) => i !== "no_leaf");
  const noLeaf = issues.includes("no_leaf");
  const bn: string[] = [];
  const en: string[] = [];
  if (adj.length) {
    bn.push(`ছবিটি ${joinBn(adj.map((i) => BN[i]))}।`);
    en.push(`The image is ${joinEn(adj.map((i) => EN[i]))}.`);
  }
  if (noLeaf) {
    bn.push("ছবিতে পাতা স্পষ্ট দেখা যাচ্ছে না।");
    en.push("The leaf is not clearly visible in the frame.");
  }
  if (level === "poor") {
    bn.push("ভালো আলোতে পাতার কাছ থেকে আবার ছবি তুলুন।");
    en.push("Retake the photo in good light, close to the leaf.");
  } else {
    bn.push("আরও ভালো ছবি তুললে ফলাফল আরও নির্ভরযোগ্য হবে।");
    en.push("A better photo would make the result more reliable.");
  }
  return { explanationBn: bn.join(" "), explanationEn: en.join(" ") };
}

/** Pure decision step, separated so calibration can be tested without decoding images. */
export function assess(m: ImageMetrics): ImageQualityResult {
  const qs: Record<Issue, number> = {
    too_small: ramp(m.minSide, THRESHOLDS.minSide),
    dark: ramp(m.meanLuminance, THRESHOLDS.darkMean),
    overexposed: ramp(m.meanLuminance, THRESHOLDS.brightMean),
    blur: ramp(m.sharpness, THRESHOLDS.sharpness),
    no_leaf: ramp(m.leafFraction, THRESHOLDS.leafFraction),
  };
  const issues = (Object.keys(qs) as Issue[]).filter((k) => qs[k] < 1);
  const weakest = Math.min(...Object.values(qs));
  const level: ImageQualityResult["level"] = weakest === 0 ? "poor" : weakest < 1 ? "acceptable" : "good";
  return { level, score: weakest, issues, ...explain(level, issues) };
}

function undecodable(): ImageQualityResult {
  return {
    level: "poor",
    score: 0,
    issues: [],
    explanationBn: "ছবিটি খোলা যায়নি। আবার ছবি তুলুন বা আপলোড করুন।",
    explanationEn: "The image could not be opened. Retake or upload it again.",
  };
}

export class SharpImageQualityChecker implements ImageQualityChecker {
  async check(input: DiagnosisProviderInput): Promise<ImageQualityResult> {
    try {
      return assess(await measureImage(input.imageBytes));
    } catch {
      return undecodable();
    }
  }
}
