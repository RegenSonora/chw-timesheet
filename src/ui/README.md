# src/ui

Preact screens. They only display and collect; rules live in `src/core`, data goes through `src/storage`.

- Follow SPEC §10: main actions in the bottom third, buttons at least 56 px, targets at least 44 px, light and dark.
- The page runs under a hash-based CSP: style with classes or style objects, never `style="..."` strings in markup.
- Every tap that changes a half-entered record saves it (`app_state.draft`), so a reload returns to the same screen.
- Only `store.tsx` talks to storage. Screens call its actions.

| File                       | What it does                                                                  | Spec                     |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------ |
| `App.tsx`                  | Opens storage, install gate, picks the screen                                 | §2, §9                   |
| `store.tsx`                | Data, actions, screen stack mirrored to history (phone back gesture), Undo    | §5, §10                  |
| `draft.ts`                 | Draft → entry: times, overlap, too short, picks, custom counts                | §5, decision 0004        |
| `format.ts`                | Dates, times, hours and clock in the phone's time zone                        | §5                       |
| `platform.ts`              | iPhone and Home Screen detection for the install gate                         | §2                       |
| `components.tsx`           | Page, dialogs, list picker, chip, steppers, fields, toast, entry row          | §10                      |
| `screens/InstallGate.tsx`  | iPhone: add to Home Screen first                                              | §2                       |
| `screens/Setup.tsx`        | Details, next invoice #, sources and rates, storage status                    | §2, §4, decision 0005    |
| `screens/Home.tsx`         | Source chip, not yet invoiced, Generate, Start, Enter times                   | §5, §6                   |
| `screens/TimerRunning.tsx` | Clock, Stop, Discard, too short, overlap                                      | §5, decision 0009        |
| `screens/EntrySteps.tsx`   | Enter times, task and budget line, counts and notes                           | §5                       |
| `screens/EditEntry.tsx`    | Edit or delete an uninvoiced entry, change its source                         | §5, decision 0008        |
| `screens/AllEntries.tsx`   | Every uninvoiced entry for the chip's source                                  | decision 0007            |
| `screens/Settings.tsx`     | Details, next invoice #, rates, NTE, add a source, rate change check, storage | §4, decisions 0005, 0010 |

The Generate button opens a "coming next" note until M4 adds the invoice screens.
