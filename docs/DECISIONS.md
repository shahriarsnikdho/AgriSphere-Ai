# Decisions (ADR log)
| # | Date | Decision | Status |
|---|---|---|---|
| 1 | 2026-10-10 | MVP scope = disease detection + advisory + alerts + history. Weather/crop recommendation deferred. | Confirmed by Snikdho |
| 2 | 2026-10-10 | Zod schemas are the contract source of truth; TS types inferred. | Proposed |
| 3 | 2026-10-10 | Confidence is a number in [0,1]; UI formats as %. | Proposed (assumed; confirm) |
| 4 | 2026-10-10 | Severity is an independent enum; never derived from confidence. | Proposed |
| 5 | 2026-10-10 | Branching: protected `main` + short-lived `type/owner/topic` branches, squash merge, no `develop`. | Proposed (assumed; confirm) |
| 6 | 2026-10-10 | Deterministic functions only; no agents/MCP/RAG/vector DB in MVP. | Proposed |
| 7 | 2026-10-10 | `LOW_CONFIDENCE_THRESHOLD = 0.6` is provisional until Joy calibrates it on evaluation data. | Open |
| 8 | 2026-10-10 | Scaffold uses system fonts (no Google Fonts fetch) for deterministic CI; Sejda picks the Bangla font. | Done |
| 9 | 2026-10-10 | Inference hosting (separate HTTP service vs hosted API) | Open — Joy |
