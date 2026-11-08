/**
 * Suggestions stored before #23 have no `bodyArea` in their snapshot. On load
 * the adapter fills it in from the library by Id; an Exercise no longer in the
 * library keeps its snapshot as it is (without one). Pure, so it is tested.
 */
import type { Exercise, SuggestedExercise } from '../core';

export function withBodyAreas(suggestion: SuggestedExercise[], library: readonly Exercise[]): SuggestedExercise[] {
  return suggestion.map((e) => {
    // Typed as always present; absent at runtime on a pre-#23 row.
    if ((e as Partial<SuggestedExercise>).bodyArea !== undefined) return e;
    const bodyArea = library.find((x) => x.id === e.id)?.bodyArea;
    return bodyArea === undefined ? e : { ...e, bodyArea };
  });
}
