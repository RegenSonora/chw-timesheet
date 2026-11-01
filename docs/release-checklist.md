# Release checklist (real phones)

Run on **one iPhone** (Safari) and **one Android phone** (Chrome) before each release that CHWs will use (CLAUDE.md "Definition of done"; BUILD_PLAN M5, M6). The automated tests cover the rules and both browser engines; this list covers what only a real phone can show.

Write down for the record: date, who ran it, phone model, OS version, browser version, and the app version from the bottom of Settings (for example `Version 0.9.0 (a1b2c3d)`).

Mark each step ✅ or ❌. Any ❌ blocks the release until fixed or accepted by Chris in `docs/decisions/`.

## Before you start

- [ ] CI is green on `main` and the Pages deploy finished.
- [ ] https://regensonora.github.io/chw-timesheet/ opens and Settings shows the commit just deployed.
- [ ] The phone has a mail app signed in, and (Android) Adobe Acrobat Reader installed.
- [ ] Use a test name and initials (for example "Test CHW", `TT`). Delete the app from the phone afterwards.

## 1. Install

| # | iPhone | Android |
|---|---|---|
| 1.1 | Open the address in **Safari**. The page says to add the app to the Home Screen; setup is **not** shown. | Open the address in **Chrome**. Setup is shown. |
| 1.2 | Share › **Add to Home Screen**. The icon shows white "CHW" on blue and the name "CHW Time". | Menu › **Install app** (or **Add to Home screen**). Same icon; on the app drawer it is not cut off. |
| 1.3 | Open the app from the Home Screen icon. It opens full screen (no Safari bars) and shows setup. | Open from the icon. It opens full screen and shows setup. |
| 1.4 | Setup warns that removing the app from the Home Screen (iPhone) or clearing the site's data (Android) erases entries not yet invoiced. | Same warning. |
| 1.5 | Finish setup. Home shows "Not yet invoiced". | Same. |

## 2. Storage status

- [ ] Settings › This phone shows the storage status. Write down what it says (protected / not protected / can't protect).
- [ ] The status reads in plain words, and the "Invoice often" hint is shown.

## 3. Offline

- [ ] With signal, open the app once and wait 10 seconds.
- [ ] Close the app fully (swipe it away). Turn on **airplane mode** (Wi-Fi off too).
- [ ] Open the app from the icon. Home appears with your entries; no "no internet" page.
- [ ] Start the timer, wait 8 minutes, Stop, pick a task and budget line, Save. The entry shows on Home.
- [ ] Add an entry with **Enter times instead**. It saves.
- [ ] Close the app, open it again, still offline. Both entries are there.
- [ ] Turn airplane mode off.

## 4. Timer survives closing the app

- [ ] Start the timer. Close the app fully. Wait 2 minutes. Open it: the clock kept counting from the start time.
- [ ] Lock the phone for 10 minutes, unlock, open: still counting. Stop and save (or Discard timer).

## 5. Invoice and share sheet

- [ ] Have at least 8 entries on 8+ different dates (use Enter times with past dates).
- [ ] Tap **Generate … invoice**. The preview shows the right hours, rate and total.
- [ ] Tap **Create invoice files**. "Invoice created" shows the three file names.
- [ ] Tap **Share files**. The phone's share sheet opens with **all three files**: the PDF and both CSVs.
- [ ] Share to Mail (iPhone) or Gmail (Android) and send to yourself. The email arrives with all three attachments, with the right names.
- [ ] Open the PDF from the email: invoice page, then timesheet pages; text is sharp; the QR code is visible.
- [ ] Open each CSV in a spreadsheet app: one header row, no broken columns.
- [ ] Settings › **Past invoices** › tap the invoice › **Share files** again. The share sheet has the same three files.

## 6. Signing

| # | iPhone | Android |
|---|---|---|
| 6.1 | Open the PDF from Mail. Tap **Markup**, add a signature on the CHW line, tap **Done**. | Open the PDF in **Adobe Acrobat Reader**. **Fill & Sign**, add a signature on the CHW line, save. |
| 6.2 | Forward the signed PDF and both CSVs to a second address. | Same. |
| 6.3 | Open the signed PDF on a computer: the signature is there and the text is still selectable. | Same. |

## 7. Update flow

Needs a new build deployed while the phone has the app installed (any small commit to `main`).

- [ ] Before the deploy, note the version in Settings.
- [ ] After the deploy finishes, start a timer in the app. Close and reopen the app (not fully closed: switch away and back). **No** update bar appears while the timer runs.
- [ ] Stop the timer and save the entry. Back on Home, the bar **"Updated, tap to reload"** appears above the buttons (it may take up to a minute, or a second switch away and back).
- [ ] Tap it. The app reloads on Home; entries are all there; Settings shows the **new** version.
- [ ] Repeat once without tapping: deploy, then fully close and reopen the app. The new version loads by itself; no entry is lost.

## 8. Idle for 8+ days (iPhone)

Safari may erase website data after 7 days without use; an app opened from the Home Screen should keep it.

- [ ] Leave at least one entry not yet invoiced. Note the date.
- [ ] Don't open the app for **8 days or more**.
- [ ] Open it from the Home Screen icon. The entry is still there. Write down how many days it was.

## 9. Field checks

- [ ] Outdoors in sunlight, the timer, Stop and Save are easy to read and tap.
- [ ] Switch the phone to dark mode: every screen is readable.
- [ ] Text size set to large in the phone's settings: nothing is cut off on Home, the entry steps or the invoice preview.

## After

- [ ] Remove the app from the phone (this erases the test data).
- [ ] File the results with the release (PR or issue comment), including any ❌ and what was done about it.
