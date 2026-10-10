# Integration contracts
Source: `src/contracts/schemas.ts` (zod, `.strict()`). Examples: `src/contracts/examples.ts`. Tests: `src/contracts/contracts.test.ts`.

| Contract | Owner | Producer | Consumer | Key validation | Error behaviour |
|---|---|---|---|---|---|
| `ImageQualityResult` | Joy | quality checker | pipeline, UI | level enum, score 0..1, issues enum, Bangla+English explanation | invalid → treat as `invalid_response`; `poor` → status `poor_image` |
| `ProviderOutput` | Joy | diagnosis provider | pipeline only | confidence 0..1, severity enum, snake_case slugs, no extra keys | invalid → `invalid_response`, never shown raw |
| `DiagnosisResult` | Snikdho | pipeline | UI, DB, alerts | all above + required disclaimer + status/disease cross-rules | stored only if valid |
| `RecommendationResult` | Samia | recommendation engine | UI | ≥1 Bangla step, `validated` set only by safety validator | `null` when no safe advice allowed |
| `RiskResult` | Samia | risk logic | alerts, UI | level enum, followUpInDays 1..60 | — |
| `Alert` | Samia | alert logic | UI, DB | type enum, Bangla message | — |
| `FarmerProfile` | Rajva | DB/auth | UI, pipeline | id = auth user id | — |
| `ApiError` | Snikdho | all routes | UI | fixed code enum, generic message | no stack traces/secrets |

## Endpoints (planned)
`POST /api/diagnose` · `GET /api/diagnoses` · `GET/DELETE /api/diagnoses/:id` · `GET /api/timeline?crop=` · `GET /api/alerts` · `PATCH /api/alerts/:id`.
Non-owner access returns 404, not 403.

## Valid payload
See `validDiagnosis` in `src/contracts/examples.ts` (confidence `0.82`, severity `moderate`, `source: "mock_demo"`).
## Invalid payload
`invalidDiagnosisPercentConfidence` — confidence `82` (percentage) is rejected.
