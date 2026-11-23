import { describe, expect, it } from 'vitest';
import { MAX_DOSE_AMOUNT, type Dose } from '../../core';
import { stepAmount, withDose, withExcluded, withKind, withoutDose } from './exerciseCard';

const reps = (amount: number, eachSide = false): Dose => ({ kind: 'reps', amount, eachSide });
const secs = (amount: number, eachSide = false): Dose => ({ kind: 'seconds', amount, eachSide });

describe('withDose: the Dose overrides after saving a Dose on an Exercise card', () => {
  it('stores a Dose that differs from the library Dose, keeping the other overrides', () => {
    const overrides = { Neck_Tilt: reps(12) };

    expect(withDose(overrides, 'Wrist_Circles', reps(10), reps(15))).toEqual({ Neck_Tilt: reps(12), Wrist_Circles: reps(15) });
  });

  it('replaces an existing override', () => {
    expect(withDose({ Wrist_Circles: reps(15) }, 'Wrist_Circles', reps(10), secs(30, true))).toEqual({
      Wrist_Circles: secs(30, true),
    });
  });

  it('removes the Id when the saved Dose equals the library Dose, so it is no longer Customised', () => {
    const overrides = { Neck_Tilt: reps(12), Wrist_Circles: reps(15) };

    expect(withDose(overrides, 'Wrist_Circles', reps(10), reps(10))).toEqual({ Neck_Tilt: reps(12) });
  });

  it('a Dose that differs only in Each Side is stored', () => {
    expect(withDose({}, 'Side_Neck_Stretch', secs(20, true), secs(20, false))).toEqual({ Side_Neck_Stretch: secs(20, false) });
  });
});

describe('withoutDose: Reset to default', () => {
  it('removes the Id and keeps the other overrides', () => {
    expect(withoutDose({ Neck_Tilt: reps(12), Wrist_Circles: reps(15) }, 'Wrist_Circles')).toEqual({ Neck_Tilt: reps(12) });
  });
});

describe('withExcluded: Exclude / Bring back', () => {
  it('Exclude adds the Id once, keeping the others', () => {
    expect(withExcluded(['Neck_Tilt'], 'Star_Jump', true)).toEqual(['Neck_Tilt', 'Star_Jump']);
    expect(withExcluded(['Star_Jump'], 'Star_Jump', true)).toEqual(['Star_Jump']);
  });

  it('Bring back removes the Id, keeping the others', () => {
    expect(withExcluded(['Neck_Tilt', 'Star_Jump'], 'Star_Jump', false)).toEqual(['Neck_Tilt']);
  });
});

describe('stepAmount: the Dose editor stepper', () => {
  it('reps step by 1', () => {
    expect(stepAmount(reps(10), 1)).toBe(11);
    expect(stepAmount(reps(10), -1)).toBe(9);
  });

  it('seconds step to the next or previous multiple of 5', () => {
    expect(stepAmount(secs(20), 1)).toBe(25);
    expect(stepAmount(secs(20), -1)).toBe(15);
    expect(stepAmount(secs(12), 1)).toBe(15);
    expect(stepAmount(secs(12), -1)).toBe(10);
  });

  it('stays within 1 and 999', () => {
    expect(stepAmount(reps(1), -1)).toBe(1);
    expect(stepAmount(secs(5), -1)).toBe(1);
    expect(stepAmount(secs(1), 1)).toBe(5);
    expect(stepAmount(reps(MAX_DOSE_AMOUNT), 1)).toBe(999);
    expect(stepAmount(secs(995), 1)).toBe(999);
  });
});

describe('withKind: switching the Dose editor between reps and seconds', () => {
  it('back to the library kind gives the library amount', () => {
    expect(withKind(reps(14, true), 'seconds', secs(20, false))).toEqual(secs(20, true));
  });

  it('to the other kind gives 10 reps or 30 s, keeping Each Side', () => {
    expect(withKind(secs(20, true), 'reps', secs(20, true))).toEqual(reps(10, true));
    expect(withKind(reps(10), 'seconds', reps(10))).toEqual(secs(30));
  });
});
