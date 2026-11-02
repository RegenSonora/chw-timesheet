# 0025 — Home: Generate Regen Invoice and Hand enter time, big and green

- **Status:** Accepted, November 2, 2026
- **Spec:** SPEC §5 (Home, entering times), §6 (Generate button), §10 (styling); changes decision 0006's button label for this app

## Decision

1. **"Generate Regen Invoice"** replaces "Generate TISUPP invoice". The invoice is billed to Regenerating Sonora, so the button names who it goes to. Files, invoice numbers and the PDF keep the source code (TISUPP) as before.
2. **"Hand enter time"** replaces "Enter times instead". The screen it opens is still called "Enter times".
3. **Both are as big as Start timer** (72 px tall, 22 px text), with a **green background and dark brown text**, in light and dark mode. Start timer stays blue.
4. **Nothing waiting** on Home now says: "Start timer and start working or hand enter times."

Colors: the green is the icon's field green `#5fa845`, with a `#4c8f37` border and `#2e1a0b` dark brown text. That is 5.6:1, which passes WCAG 2.1 AA for any text size. The icon's own brown `#8a5a3c` on that green is only 2:1, so it is not used for text.

## Why

The two actions besides the timer were asked to be as easy to see and tap as the timer, in the app's own colors, with plainer words.

## Change, November 2, 2026

"Hand enter time" is renamed **"Record time"**, and the Home text with nothing waiting now says "Start timer and start working or record time." Size and colors are unchanged.
