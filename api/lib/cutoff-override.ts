/**
 * Runtime cutoff override — in-memory only, resets on server restart.
 * Used by the admin toggle to disable/re-enable the cutoff for testing.
 */

export type CutoffOverride =
  | { enabled: false }                          // cutoff disabled — always open
  | { enabled: true; hour: number; minute: number }; // cutoff at specific time

let _override: CutoffOverride | null = null;

export function getCutoffOverride(): CutoffOverride | null {
  return _override;
}

export function setCutoffOverride(override: CutoffOverride | null): void {
  _override = override;
}
