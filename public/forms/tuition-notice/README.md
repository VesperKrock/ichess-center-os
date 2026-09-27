# TBHP runtime assets

Runtime uses `tuition-notice-a4-background.pdf`, a native **595.2756 × 841.8898 pt**, single-page A4 background containing only the approved iChess identity/title graphic and watermark. It contains no Student, package, progress, price, session rows, bank account, QR, contact data or prototype warning.

The header was rendered at 3 pixels/pt from the existing approved `tuition-notice-template.pdf`, cropped to its identity/title region `[50, 692, 550, 782]`, and placed without resizing at the golden A4 position. The original watermark image and alpha mask were extracted separately and placed at the golden position. This is a blank graphic background, not a filled golden PDF. The legacy Letter asset remains only as the original graphic source; the current renderer never loads it.

| Asset | SHA-256 |
|---|---|
| Original `tuition-notice-template.pdf` | `3acbc86a6633f780fcdebd2951aa9e28b1603142b737660e5d1ae2f933b9ac6a` |
| A4 `tuition-notice-a4-background.pdf` | `2ef559a0d30597ca5d59ff1bc223586d1a3a200380c1ff5b598acf056ebd88a7` |
| `fonts/Lora-Regular.ttf` | `80aac4498fe8b3c16c54ae820a72506c929ccaee96b92c226f915a901c857a96` |
| `fonts/Lora-Bold.ttf` | `2aba152528d3526cbb342d8564f19aa92ca9d2e71d2c7e98fec98c5c89558558` |
| `fonts/Lora-Italic.ttf` | `27aac8eaa1b9ca94554cdc2c7ae2799d4dcea72055b95bfdc7fdc450cf9a77a4` |

The three full fonts were extracted from the original template's `NewLoraR/B/I` resources. QA verifies their bytes equal the approved goldens' `LoraR/B/I` resources. Runtime verifies asset hashes and loads explicit font faces before rendering. No dependency on an installed Lora font or substitution to Times exists for dynamic content.

The existing `assets/payment/ichess-company-tuition-qr.png` is unchanged. The A4 renderer adds the fixed white quiet zone shown in the golden and embeds the same company QR separately from the text overlay. Golden files remain under `docs/business-reference/tuition-notice/golden-a4` and are never fetched by runtime.
