"use client";

/**
 * DEMO UI (prototype by Snikdho). Sejda owns the real frontend and will replace this.
 * Talks to /api/demo/diagnose. Results are sample data; the image is not analysed or stored.
 */
import { useEffect, useState } from "react";
import {
  ApiErrorSchema,
  DISCLAIMER_EN,
  DiagnoseResponseSchema,
  type DiagnoseResponse,
  type Severity,
} from "@/contracts";
import { DEMO_SCENARIOS, DEMO_SCENARIO_LABELS, type DemoScenario } from "@/lib/demo/scenarios";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

const SEVERITY_BN: Record<Severity, string> = { none: "নেই", low: "কম", moderate: "মাঝারি", high: "বেশি", unknown: "অজানা" };
const SEVERITY_STYLE: Record<Severity, string> = {
  none: "bg-emerald-100 text-emerald-900",
  low: "bg-lime-100 text-lime-900",
  moderate: "bg-amber-100 text-amber-900",
  high: "bg-red-100 text-red-900",
  unknown: "bg-zinc-200 text-zinc-800",
};
const DISEASE_BN: Record<string, string> = { rice_leaf_blast: "ধানের ব্লাস্ট (Rice Leaf Blast)", unknown: "অজানা রোগ (Unknown)" };
const STATUS_NOTE: Record<string, { text: string; style: string } | undefined> = {
  low_confidence: { text: "অনুমান নিশ্চিত নয় (Low confidence)। নিচের ফলাফল ভরসাযোগ্য নয়।", style: "bg-amber-50 border-amber-300 text-amber-900" },
  unknown_disease: { text: "রোগটি চেনা যায়নি (Unknown disease)। কৃষি কর্মকর্তার সাথে যোগাযোগ করুন।", style: "bg-amber-50 border-amber-300 text-amber-900" },
  poor_image: { text: "ছবির মান খারাপ (Poor image)। আবার ছবি তুলুন।", style: "bg-red-50 border-red-300 text-red-900" },
};
const API_ERROR_BN: Record<string, string> = {
  provider_unavailable: "এআই সেবা এখন পাওয়া যাচ্ছে না (Provider unavailable)। পরে আবার চেষ্টা করুন।",
  invalid_provider_response: "এআই সেবার উত্তর বৈধ ছিল না, তাই ফলাফল দেখানো হয়নি (Invalid provider output)।",
  unsupported_media_type: "শুধু JPEG, PNG বা WebP ছবি দিন।",
  payload_too_large: "ছবি ৫ MB এর বেশি বড়।",
};

type Phase = "idle" | "loading" | "done" | "error";
type HistoryItem = { at: string; disease: string; confidence: number; status: string };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-300 bg-white p-4 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
      <h2 className="mb-2 text-sm font-semibold text-zinc-600 dark:text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

export default function DemoClient() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scenario, setScenario] = useState<DemoScenario>("blast_ok");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function fail(msg: string) { setMessage(msg); setPhase("error"); }

  function onPick(f: File | null) {
    setResult(null); setMessage(null); setPhase("idle");
    if (!f) { setFile(null); setPreview(null); return; }
    if (!TYPES.includes(f.type)) { setFile(null); setPreview(null); return fail(API_ERROR_BN.unsupported_media_type); }
    if (f.size > MAX_BYTES) { setFile(null); setPreview(null); return fail(API_ERROR_BN.payload_too_large); }
    setFile(f); setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return fail("ইন্টারনেট সংযোগ নেই (Offline)। সংযোগ দেখে আবার চেষ্টা করুন।");
    setPhase("loading"); setMessage(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("scenario", scenario);
      const res = await fetch("/api/demo/diagnose", { method: "POST", body: fd });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const e = ApiErrorSchema.safeParse(json);
        return fail(e.success ? (API_ERROR_BN[e.data.error.code] ?? e.data.error.message) : "অজানা সমস্যা হয়েছে।");
      }
      const parsed = DiagnoseResponseSchema.safeParse(json);
      if (!parsed.success) return fail("সার্ভারের উত্তর বৈধ নয়।");
      const d = parsed.data.diagnosis;
      setResult(parsed.data); setPhase("done");
      setHistory((h) => [{ at: new Date().toLocaleTimeString(), disease: d.disease, confidence: d.confidence, status: d.status }, ...h].slice(0, 8));
    } catch {
      fail("সার্ভারে পৌঁছানো যায়নি। ইন্টারনেট সংযোগ দেখুন (Network error)।");
    }
  }

  const d = result?.diagnosis;
  const note = d ? STATUS_NOTE[d.status] : undefined;
  const showScores = d && d.status !== "poor_image";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-12">
      <header>
        <h1 className="text-2xl font-bold">AgriSphere</h1>
        <p className="text-sm opacity-80">ধানের পাতার ছবি দিয়ে রোগের প্রাথমিক অনুমান</p>
      </header>

      <div role="note" className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
        <strong>DEMO MODE · ডেমো মোড</strong>
        <br />ফলাফল নমুনা তথ্য। আপনার ছবি বিশ্লেষণ বা সংরক্ষণ করা হয় না।
        <br /><span className="opacity-80">Sample data only. The image is not analysed or stored.</span>
      </div>

      <Card title="১. পাতার ছবি দিন (Upload leaf photo)">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-white"
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected leaf preview" className="mt-3 max-h-64 w-full rounded-lg object-contain" />
        ) : (
          <p className="mt-3 text-sm opacity-70">এখনো কোনো ছবি নেওয়া হয়নি (No image selected). JPEG/PNG/WebP, সর্বোচ্চ ৫ MB।</p>
        )}
        <label className="mt-4 block text-xs font-medium opacity-80" htmlFor="scenario">Demo scenario (to show each state)</label>
        <select
          id="scenario"
          value={scenario}
          onChange={(e) => setScenario(e.target.value as DemoScenario)}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-900"
        >
          {DEMO_SCENARIOS.map((s) => <option key={s} value={s}>{DEMO_SCENARIO_LABELS[s]}</option>)}
        </select>
        <button
          onClick={analyze}
          disabled={!file || phase === "loading"}
          className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "loading" ? "বিশ্লেষণ চলছে…" : "বিশ্লেষণ করুন (ডেমো)"}
        </button>
      </Card>

      {phase === "error" && message && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {message}
          {file && <button onClick={analyze} className="ml-2 underline">আবার চেষ্টা করুন</button>}
        </div>
      )}

      {d && result && (
        <>
          <Card title="২. ফলাফল (Result)">
            <div className="mb-2 flex flex-wrap gap-2 text-xs">
              {d.source === "mock_demo" && <span className="rounded-full bg-amber-200 px-2 py-0.5 font-semibold text-amber-950">DEMO DATA</span>}
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-800">status: {d.status}</span>
            </div>
            {note && <p className={`mb-3 rounded-lg border p-2 text-sm ${note.style}`}>{note.text}</p>}
            {showScores && (
              <>
                <p className="text-lg font-semibold">{DISEASE_BN[d.disease] ?? d.disease}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs opacity-70">নিশ্চয়তা (Confidence)</p>
                    <p className="text-xl font-bold">{Math.round(d.confidence * 100)}%</p>
                    <div className="mt-1 h-2 w-full rounded bg-zinc-200"><div className="h-2 rounded bg-emerald-600" style={{ width: `${Math.round(d.confidence * 100)}%` }} /></div>
                  </div>
                  <div>
                    <p className="text-xs opacity-70">তীব্রতা (Severity)</p>
                    <span className={`mt-1 inline-block rounded-lg px-3 py-1 text-lg font-bold ${SEVERITY_STYLE[d.severity]}`}>{SEVERITY_BN[d.severity]}</span>
                  </div>
                </div>
                {d.symptoms.length > 0 && (
                  <div className="mt-3 text-sm"><p className="font-medium">লক্ষণ (Symptoms)</p><ul className="ml-5 list-disc">{d.symptoms.map((s) => <li key={s}>{s}</li>)}</ul></div>
                )}
                {d.earlyDetection?.isEarlyStage && <p className="mt-2 text-sm">🌱 প্রাথমিক পর্যায়ে শনাক্ত (Early stage)</p>}
              </>
            )}
            <div className="mt-3 text-sm">
              <p className="font-medium">ছবির মান (Image quality): {d.imageQuality.level} ({Math.round(d.imageQuality.score * 100)}%)</p>
              <p className="opacity-80">{d.imageQuality.explanationBn}</p>
            </div>
            <p className="mt-3 rounded-lg bg-zinc-100 p-2 text-xs text-zinc-800">{d.disclaimer}<br />{DISCLAIMER_EN}</p>
          </Card>

          {result.recommendation && (
            <Card title="৩. পরামর্শ (Recommendation)">
              <p className="font-semibold">{result.recommendation.titleBn}</p>
              <ol className="ml-5 mt-2 list-decimal space-y-1 text-sm">{result.recommendation.stepsBn.map((s) => <li key={s}>{s}</li>)}</ol>
              <ul className="mt-3 space-y-1 text-xs opacity-80">{result.recommendation.safetyNotesBn.map((s) => <li key={s}>⚠ {s}</li>)}</ul>
              {!result.recommendation.validated && <p className="mt-2 text-xs font-semibold text-amber-700">Not yet validated by the safety layer (demo).</p>}
            </Card>
          )}

          <Card title="৪. ঝুঁকি ও সতর্কতা (Risk & alerts)">
            <p className="text-sm">ঝুঁকি (Risk): <strong>{result.risk.level}</strong>{result.risk.followUpInDays ? ` · ফলো-আপ: ${result.risk.followUpInDays} দিন পর` : ""}</p>
            {result.alerts.length === 0 ? <p className="mt-2 text-sm opacity-70">কোনো সতর্কতা নেই (No alerts).</p> : (
              <ul className="mt-2 space-y-2">{result.alerts.map((a) => (
                <li key={a.id} className="rounded-lg border border-orange-300 bg-orange-50 p-2 text-sm text-orange-950"><span className="text-xs font-semibold">{a.type}</span><br />{a.messageBn}</li>
              ))}</ul>
            )}
          </Card>
        </>
      )}

      <Card title="৫. এই সেশনের ইতিহাস (Session history, not saved)">
        {history.length === 0 ? <p className="text-sm opacity-70">এখনো কোনো ফলাফল নেই (Empty history).</p> : (
          <ul className="space-y-1 text-sm">{history.map((h, i) => (
            <li key={i} className="flex justify-between gap-2 border-b border-zinc-200 pb-1 last:border-0"><span>{h.at}</span><span>{DISEASE_BN[h.disease] ?? h.disease}</span><span>{Math.round(h.confidence * 100)}% · {h.status}</span></li>
          ))}</ul>
        )}
      </Card>
    </main>
  );
}
