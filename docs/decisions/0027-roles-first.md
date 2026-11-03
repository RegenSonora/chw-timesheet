# 0027 — Roles first

- **Status:** Accepted by Chris, November 3, 2026
- **Spec:** SPEC §3 (roles), §4 (setup and settings), §5, §6
- **Plan:** [roles plan](../roles-plan.md), milestones R1–R7

## Decision

1. **The logic follows how Regen staffs work:** people hold roles, and funding sources pay for roles.
2. **`src/roles/roles.json` holds the roles.** Each role lists its funding sources, the budget lines under each source, and the tasks under each line. The same task can appear under several lines and roles. The build checks the file against the funding sources (`scripts/lib/roles.mjs`).
3. **One role per person.**
4. **Setup:**
   - The person types their own name, initials and mailing address, then picks their role from the active roles, shown by code and name.
   - The funding sources come from the role, so there are no source checkboxes.
   - A review screen shows the role's sources, budget lines and tasks, with **This is my role** and **Pick a different role**.
   - The rate is prefilled (decision 0030), and the role can be changed until setup is finished.
5. **The role is locked after setup.** Settings shows it read-only ("CHW-TC01 · CHW Trainee (Contractor)", "Set at setup. Ask the office to change it."). The office changes what people see by editing a role (this affects everyone in it) or by retiring a role with `replaced_by` (this moves everyone in it).
6. **No code for changing your role on the phone.** A wrong pick is fixed one of two ways:
   - The person invoices or submits any waiting hours, then clears the app's data and sets up again. On iPhone that means removing the app from the Home Screen and adding it again; on Android, clearing the site's data in Chrome.
   - Or the office retires the role and points it at the right one, which moves everyone in it.
7. **Roles never name a person**, so nothing personal ships in the public page.

## Decided during the build

- **Phones set up before roles keep working with no role** (R3, R4). Upgraded data gets `role_id: null`; no role is guessed. Such a phone keeps the 0.10.0 behavior: source-based task lists, the five CHW counts, the source's raise reminder and certification countdown, and "Add a funding source", until the app is cleared and set up again.
- **Office changes after setup** (R7):
  - **A role is edited:** the new choices show after "Updated, tap to reload". An entry that uses a removed budget line or task keeps it and can still be invoiced unchanged; editing it asks for a new pick.
  - **A role is retired with `replaced_by`:**
    - On its next open, the phone moves the profile to the replacement and adds rates (decision 0030) for any source the new role bills that wasn't set up.
    - Home shows "Your role was updated by the office: R-TL02 · …" once, with an OK button. If the new role's suggested rate differs from the rate in Settings, the notice says so; rates are never changed automatically.
    - The profile is saved last, so a switch cut short runs again on the next open.
  - **A role is retired with no replacement, or its id is gone from the file:** Home says "Your role is no longer active. Ask the office." Start timer and Record time are hidden. Waiting hours can still be invoiced or submitted, and entries can still be edited.
  - **Waiting hours keep the role they were logged under.** The next invoice or timesheet takes the role of the oldest waiting hours at that source and bills only those hours, as that role's kind. After a contractor/employee switch, the old type's hours go out first; the preview says when more entries wait under the new role.

## Why

People, not funding sources, are what the office staffs and pays. Putting sources, lines, tasks and counts under a role lets the office change what a whole group sees in one place, and keeps each person's choices short.
