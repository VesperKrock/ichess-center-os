# Receipt A5 runtime assets

`tuition-receipt-a5-background.pdf` is an unfilled A5 landscape page containing only the approved iChess logo, outer frame and four separators. It contains no business text, Receipt number or prototype watermark. SHA-256: `8df5e60a4a9f3fa8a17f801f75501087f35c694e6f322e2ba339c55097eb004c`.

The logo and the full Tinos font programs were extracted from the approved `docs/business-reference/tuition-receipt/golden-a5/receipt-a5-new-registration-golden.pdf`. Both golden references embed the same three font programs. Runtime embeds the needed glyphs into each generated PDF, so Vietnamese text remains searchable and printing does not depend on installed fonts.

| Font | SHA-256 |
|---|---|
| Tinos-Regular.ttf | `60a0e8ef0c04dd5dd69ffe91025fa2ae5836cbd35600a82ba031977557e2cb61` |
| Tinos-Bold.ttf | `393269dbab8899f938db19783eca5eac92eb431f7ae0ab45b8349ca895f1a06b` |
| Tinos-Italic.ttf | `5942266ed398b155d7dc23e36833e7ec6be988f2439bdbeb8ef1bede808eaa91` |

Tinos is Copyright 2026 The Tinos Project Authors, licensed under SIL Open Font License 1.1; see `fonts/OFL.txt`. This matches the copyright and license metadata in the extracted font programs. The old `tuition-receipt-template.pdf` is retained as a reference and is no longer used by the A5 runtime renderer. Filled golden PDFs are never served as production Receipts.
