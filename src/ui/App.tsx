interface AppProps {
  version: string;
}

/** Placeholder screen for M0: proves the build and the Pages deploy on a phone. */
export function App({ version }: AppProps) {
  return (
    <main class="placeholder">
      <h1>CHW Time Tracker</h1>
      <p class="version">Version {version}</p>
    </main>
  );
}
