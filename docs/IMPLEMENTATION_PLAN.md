# Implementation plan
| # | Task | Owner | Depends | Acceptance | Status |
|---|---|---|---|---|---|
| 1 | Scaffold, CI, CODEOWNERS, env example | Snikdho | — | lint/typecheck/test/build pass | Done locally (not yet pushed) |
| 2 | Contracts + validation helpers + tests | Snikdho | 1 | 33 contract tests pass | Done locally (not yet pushed) |
| 3 | Supabase schema, private bucket, auth, RLS | Rajva | 2 | two-user isolation test passes | Not started |
| 4 | UI shell, auth pages, upload (mock) | Sejda | 2,3 | mobile OK; protected routes redirect | Not started |
| 5 | Provider interface impl + mock provider + quality checker | Joy | 2 | passes contract tests; mock labelled | Not started |
| 6 | `/api/diagnose` orchestration | Snikdho | 3,5,7 | pipeline tests for all statuses | Not started |
| 7 | Recommendation engine + safety validator | Samia | 2 | disclaimer always present; unsafe advice blocked | Not started |
| 8 | Risk + alerts | Samia | 7 | high-severity & low-confidence alerts | Not started |
| 9 | Persistence, history, timeline | Rajva+Sejda | 3,6,8 | save/retrieve, empty state | Not started |
| 10 | Deploy, smoke test, demo docs | Snikdho | 9 | verified live URL | Not started |
Still to write: PRD.md, DEPLOYMENT.md, KNOWN_LIMITATIONS.md, demo script, pitch, judge Q&A.
