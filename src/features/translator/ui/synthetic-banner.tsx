/** Shown at the top of the Translator while Phase 1 runs on synthetic data only. */
export function SyntheticBanner() {
  return (
    <p
      role="note"
      className="rounded-xl border border-gold-light bg-parchment px-5 py-4 text-base font-medium text-parchment-text"
    >
      <strong className="font-bold text-ink">Synthetic demonstration.</strong> All companies and people are fictional.
    </p>
  );
}
