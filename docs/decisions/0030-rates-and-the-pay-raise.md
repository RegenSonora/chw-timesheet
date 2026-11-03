# 0030 — Rates and the pay raise

- **Status:** Accepted by Chris, November 3, 2026
- **Spec:** SPEC §4 (rates), §5 (Home reminder)
- **Plan:** [roles plan](../roles-plan.md), milestones R2, R4, R7

## Decision

1. **The rate is prefilled at setup, per source.** The first of these that's set is used:
   - the role's funding entry `rate_cents`
   - the role's `suggested_rate_cents`
   - the source's `default_rate_cents`
2. **The person can still change a rate in Settings**, which covers the rare person paid more or less than their role's rate.
3. **The pay raise is a reminder, not a calculation.** It lives on the role's funding entry as `rate_step` and counts that source's invoiced or submitted hours. Only roles whose agreement has a raise get one: today, the CHW Trainee roles on TISUPP ($23.00 after 240 hours).
4. **Reminder wording** at 240 hours:
   - Contractor: "You've reached 240 hours. Generate your invoice now, then change your rate to $23.00 in Settings."
   - Employee: "You've reached 240 hours. Submit your timesheet now, then change your rate to $23.00 in Settings."
   - Once the hours are invoiced or submitted: "You've invoiced (or submitted) 240 hours. Your rate is now $23.00. Change it in Settings before your next invoice (or timesheet)."

## Decided during the build

- **After an office role change, rates are noted, never changed** (decision 0027). The one-time notice names each source whose new suggested rate differs from the rate in Settings.

## Why

The rate on the agreement is the rate the office pays, so the app fills it in but never changes it on its own. A raise that applies only after enough hours are paid is easiest to get right when the person invoices first and then changes the rate.
