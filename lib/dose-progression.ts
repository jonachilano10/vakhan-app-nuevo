export type EffortScale = "NONE" | "RIR" | "RPE";

export interface DoseProgressionConfig {
  startMinReps: number;
  startMaxReps: number;
  increment: 1 | 2 | 3;
  effortScale: EffortScale;
  effortValue: number;
}

export const DEFAULT_DOSE_PROGRESSION: DoseProgressionConfig = {
  startMinReps: 4,
  startMaxReps: 6,
  increment: 1,
  effortScale: "RIR",
  effortValue: 3,
};

export const STARTING_DOSE_OPTIONS = [
  { label: "3x3-4", min: 3, max: 4 },
  { label: "3x4-6", min: 4, max: 6 },
  { label: "3x5-7", min: 5, max: 7 },
  { label: "3x6-8", min: 6, max: 8 },
  { label: "3x7-9", min: 7, max: 9 },
  { label: "3x8-10", min: 8, max: 10 },
  { label: "3x9-11", min: 9, max: 11 },
  { label: "3x10-12", min: 10, max: 12 },
] as const;

function doseForMicrocycle(microcycle: number, config: DoseProgressionConfig) {
  let series = 3;
  let progressionSteps = microcycle - 1;

  if (microcycle === 4) {
    series = 4;
    progressionSteps = 2;
  } else if (microcycle >= 5) {
    series = 2;
    progressionSteps = microcycle - 2;
  }

  const minReps = config.startMinReps + progressionSteps * config.increment;
  const maxReps = config.startMaxReps + progressionSteps * config.increment;
  const effort =
    config.effortScale === "NONE" ? "" : ` ${config.effortScale}${config.effortValue}`;
  return `${series}x${minReps}-${maxReps}${effort}`;
}

export function buildDoseProgression(
  totalMicrocycles: number,
  config: DoseProgressionConfig,
) {
  return Object.fromEntries(
    Array.from({ length: totalMicrocycles }, (_, index) => {
      const microcycle = index + 1;
      return [String(microcycle), doseForMicrocycle(microcycle, config)];
    }),
  );
}
