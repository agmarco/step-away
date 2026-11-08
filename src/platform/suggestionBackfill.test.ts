import { describe, expect, it } from 'vitest';
import type { Exercise, SuggestedExercise } from '../core';
import { withBodyAreas } from './suggestionBackfill';

const dose = { kind: 'reps', amount: 10, eachSide: false } as const;
const libraryEntry = { id: 'Plank', bodyArea: 'Core & Lower Back' } as Exercise;

/** A Suggestion entry as stored before #23: no `bodyArea`. */
const stored = (id: string) => ({ id, name: id, dose, cue: 'cue' }) as unknown as SuggestedExercise;

describe('withBodyAreas', () => {
  it('fills a missing Body Area from the library by Id', () => {
    expect(withBodyAreas([stored('Plank')], [libraryEntry])).toEqual([
      { id: 'Plank', name: 'Plank', dose, cue: 'cue', bodyArea: 'Core & Lower Back' },
    ]);
  });

  it('keeps a stored Body Area, even if the library says otherwise', () => {
    const entry: SuggestedExercise = { ...stored('Plank'), bodyArea: 'Neck' };
    expect(withBodyAreas([entry], [libraryEntry])).toEqual([entry]);
  });

  it('leaves an Exercise that is not in the library as it is', () => {
    const entry = stored('Gone');
    expect(withBodyAreas([entry], [libraryEntry])).toEqual([entry]);
  });
});
