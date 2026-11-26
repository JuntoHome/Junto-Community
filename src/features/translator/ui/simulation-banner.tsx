import { FALLBACK_TEXT } from "../ai";

/**
 * Shown at the top of the Translator while the TR-50 failure simulation is on (`?aiFail=1`, never
 * in production), so nobody mistakes a simulated failure for a real one.
 */
export function SimulationBanner() {
  return (
    <p role="note" className="rounded-xl border border-red-700 bg-red-50 px-5 py-3 text-base font-medium text-red-800">
      {FALLBACK_TEXT.simulationBanner}
    </p>
  );
}
