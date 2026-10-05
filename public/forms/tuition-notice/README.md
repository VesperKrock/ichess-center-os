# TBHP A5 runtime assets

The only production template is `tuition-notice-template.pdf`, approved on
2026-10-05: one A5 portrait page, **419.5276 × 595.2756 pt** (148 × 210 mm).
SHA-256: `23131e615eefe01028ae18f45375a6526bb9c27156131cc54a5147621fd47814`.
Runtime rejects a different hash, page count or geometry; there is no A4 fallback.

`src/tuition-notice-a5-layout.js` defines fixed top-left field boxes, baselines,
widths, font fitting and paragraph wrapping. The renderer keeps the approved
artwork and static text, removes measured placeholder text operators, and adds
searchable vector text using the existing licensed Tinos Regular/Bold fonts in
`forms/tuition-receipt/fonts`. It does not cover the watermark with white boxes.

The template embeds the single company QR and payment block. QA scans its payload
and compares it with `assets/payment/ichess-company-tuition-qr.png`, account
442228866, CÔNG TY TNHH ICHESS VIET NAM, ACB. Runtime does not add a duplicate QR.
Paid notices retain explicit payment status and omit payment instructions/QR.

The persisted Settings source is `center_operational_profiles.phone`, exposed
as `snapshot.center.phone` by `tbhp_get_printable_document`. Nonblank values are
used; blank values resolve to **090 1197 260** in both contact positions.
Student birth information is bound from the existing Tuition operator Student
projection, preserving full-date/year-only/unknown precision. Dates and amounts
come from the existing frozen Tuition notice read. The advisory “Lưu ý” uses
current Tuition countable progress and current active individualized Ca học days
read at PDF generation time. Duration is `ceil(N / sessionsPerWeek) + 1` weeks;
the next-cycle forecast counts normal study occurrences strictly after today's
Vietnam date. Missing or ambiguous facts omit the relevant estimate. These
estimates are never stored and never enforce Tuition or Attendance rules.

Tests: `tests/tuition-notice-a5-runtime-qa.js` and
`tests/tuition-notice-a5-real-app-qa.js`. QA artifacts: `artifacts/l2-tbhp-a5/`.
The sample under `docs/business-reference/tuition-notice/` is a reference export
derived from the approved production template/runtime, with the approved sample
values and percentage discount annotation. L2.1 replaced its corrupt compressed
streams; production template/runtime remain authoritative. Re-export and safety
evidence: `artifacts/l2-1-tbhp/REPORT.md`.
Old A4 goldens and prior QA artifacts remain historical references only.
