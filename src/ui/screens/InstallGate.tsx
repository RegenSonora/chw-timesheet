// iPhone install gate (SPEC §2): Safari and the Home Screen app keep separate storage.

export function InstallGate() {
  return (
    <div class="screen">
      <main class="content gate">
        <div class="gate-mark" aria-hidden="true">
          CHW
        </div>
        <h1>Add CHW Time Tracker to your Home Screen</h1>
        <p class="lead">
          Your entries are saved inside the Home Screen app. Entries made here in Safari can't move
          into it later.
        </p>
        <ol class="steps">
          <li class="step">
            <span class="num" aria-hidden="true">
              1
            </span>
            <span>
              Tap the <strong>Share</strong> button
            </span>
          </li>
          <li class="step">
            <span class="num" aria-hidden="true">
              2
            </span>
            <span>
              Choose <strong>Add to Home Screen</strong>
            </span>
          </li>
          <li class="step">
            <span class="num" aria-hidden="true">
              3
            </span>
            <span>
              Open <strong>CHW Time Tracker</strong> from your Home Screen
            </span>
          </li>
        </ol>
        <p class="hint gate-foot">
          This screen shows until the app is opened from the Home Screen.
        </p>
      </main>
    </div>
  );
}
