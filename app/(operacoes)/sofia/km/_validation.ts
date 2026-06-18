export interface KmValidationInput {
  km_inicial: number
  km_final: number | null
}

/**
 * Validates the km_inicial/km_final pair read from the lançamento de KM form.
 *
 * `km_inicial` and `km_final` are read via `Number(formData.get(...))`, so a
 * missing/non-numeric value becomes `NaN` — that's the "absent" signal to
 * check for, not falsiness, because a legitimate odometer reading of `0`
 * (e.g. a brand-new vehicle) must NOT be rejected (`!0` is `true` in JS).
 *
 * Similarly, `km_final` is only genuinely absent when it is `null`/`undefined`
 * — a legitimate `km_final` of `0` must still be validated against
 * `km_inicial`, not skipped via a truthiness check.
 */
export function validateKmInput(input: KmValidationInput): string | null {
  if (input.km_inicial === null || input.km_inicial === undefined || Number.isNaN(input.km_inicial)) {
    return 'KM inicial é obrigatório'
  }
  if (
    input.km_final !== null &&
    input.km_final !== undefined &&
    !Number.isNaN(input.km_final) &&
    input.km_final < input.km_inicial
  ) {
    return 'KM final não pode ser menor que o KM inicial'
  }
  return null
}
