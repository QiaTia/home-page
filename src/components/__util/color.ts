type PresetColorKey = "tia";

type InverseColor = `${PresetColorKey}-inverse`;

export const PresetStatusColorTypes = [
    'success',
    'processing',
    'error',
    'default',
    'warning',
  ] as const;

export type PresetColorType = PresetColorKey | InverseColor;

export type PresetStatusColorType = (typeof PresetStatusColorTypes)[number];