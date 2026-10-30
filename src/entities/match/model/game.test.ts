import { describe, expect, it } from 'vitest';

import {
  append,
  applyAction,
  createMatch,
  initialGame,
  project,
  remaining,
  type Action,
  type Setup,
} from './game';
import { emptyLibrary, exportBackup, mergeBackup, validLibrary, validMatch } from './validation';

const setup: Setup = { names: ['Анна', 'Борис'], reds: 6, target: 2, starter: 0 };
const run = (...actions: Action[]) =>
  actions.reduce((g, a) => applyAction(g, a, setup), initialGame(setup));
const correct: Action = { type: 'correct', scores: [30, 20], reds: 0, phase: 2, active: 0, run: 0 };

describe('scoring and table state', () => {
  it('tracks a break, remaining points and end of visit', () => {
    const g = run({ type: 'pot', ball: 1, count: 1 }, { type: 'pot', ball: 7, count: 1 });

    expect(g.frame.scores).toEqual([8, 0]);
    expect(g.frame.run).toBe(8);
    expect(g.frame.best).toEqual([8, 0]);
    expect(remaining(g.frame)).toBe(67);
    const next = applyAction(g, { type: 'switch' }, setup);

    expect(next.frame.run).toBe(0);
    expect(next.frame.active).toBe(1);
    expect(next.frame.best).toEqual([8, 0]);
  });
  it('several reds allow just one colour, including the last red', () => {
    let g = run({ type: 'pot', ball: 1, count: 6 });

    expect(g.frame.scores[0]).toBe(6);
    expect(remaining(g.frame)).toBe(34);
    g = applyAction(g, { type: 'pot', ball: 7, count: 1 }, setup);
    expect(g.frame.phase).toBe(2);
    expect(remaining(g.frame)).toBe(27);
    expect(() => applyAction(g, { type: 'pot', ball: 7, count: 1 }, setup)).toThrow();
  });
  it('clears the colours and requires confirmation', () => {
    let g = run(correct);

    for (const ball of [2, 3, 4, 5, 6, 7] as const) {
      g = applyAction(g, { type: 'pot', ball, count: 1 }, setup);
    }

    expect(g.frame.scores).toEqual([57, 20]);
    expect(g.frame.awaiting).toBe(true);
    expect(() => applyAction(g, { type: 'switch' }, setup)).toThrow();
    g = applyAction(g, { type: 'finish', winner: 0 }, setup);
    expect(g.wins).toEqual([1, 0]);
    expect(g.frame.active).toBe(1);
    expect(g.frame.reds).toBe(6);
  });
  it('awards one foul penalty, removes reds, restores position without removing penalty', () => {
    const g = run(
      { type: 'pot', ball: 1, count: 1 },
      { type: 'foul', penalty: 5, removed: 2, next: 1 },
    );

    expect(g.frame.scores).toEqual([1, 5]);
    expect(g.frame.reds).toBe(3);
    expect(g.frame.run).toBe(0);
    const restored = applyAction(g, { type: 'restore' }, setup);

    expect(restored.frame.scores).toEqual([1, 5]);
    expect(restored.frame.reds).toBe(5);
    expect(restored.frame.phase).toBe('colour');
    expect(restored.frame.active).toBe(0);
  });
  it('handles a free ball alone and together with real reds', () => {
    let g = run({ type: 'free', reds: 0, onPotted: false });

    expect(g.frame.reds).toBe(6);
    expect(g.frame.scores[0]).toBe(1);
    expect(remaining(g.frame)).toBe(82);
    g = run({ type: 'free', reds: 2, onPotted: false });
    expect(g.frame.reds).toBe(4);
    expect(g.frame.scores[0]).toBe(3);
    expect(g.frame.phase).toBe('colour');
  });
  it('free colour alone stays on; both balls score once', () => {
    const single = run(correct, { type: 'free', reds: 0, onPotted: false });
    const both = run(correct, { type: 'free', reds: 0, onPotted: true });

    expect(single.frame.scores).toEqual([32, 20]);
    expect(single.frame.phase).toBe(2);
    expect(both.frame.scores).toEqual([32, 20]);
    expect(both.frame.phase).toBe(3);
  });
  it('tied black is respotted, and a foul can decide the frame', () => {
    const g = run({ ...correct, phase: 7, scores: [20, 27] }, { type: 'pot', ball: 7, count: 1 });

    expect(() => applyAction(g, { type: 'finish', winner: 0 }, setup)).toThrow();
    let next = applyAction(g, { type: 'respot', starter: 1 }, setup);

    expect(remaining(next.frame)).toBe(7);
    next = applyAction(next, { type: 'foul', penalty: 7, removed: 0, next: 0 }, setup);
    expect(next.frame.scores).toEqual([34, 27]);
    expect(next.frame.awaiting).toBe(true);
    expect(applyAction(next, { type: 'finish', winner: 0 }, setup).wins).toEqual([1, 0]);
  });
  it('a foul on the final black can produce a tie', () => {
    const g = run(
      { ...correct, phase: 7, scores: [27, 20] },
      { type: 'foul', penalty: 7, removed: 0, next: 1 },
    );

    expect(g.frame.awaiting).toBe(true);
    expect(g.frame.scores).toEqual([27, 27]);
  });
  it('concessions reach the target and prevent further scoring', () => {
    const g = run({ type: 'finish', winner: 1 }, { type: 'finish', winner: 1 });

    expect(g.winner).toBe(1);
    expect(() => applyAction(g, { type: 'pot', ball: 1, count: 1 }, setup)).toThrow();
  });
  it('undo by replay restores the complete previous state and best break', () => {
    const m = append(append(createMatch(setup), { type: 'pot', ball: 1, count: 1 }), {
      type: 'pot',
      ball: 7,
      count: 1,
    });
    const g = project({ ...m, events: m.events.slice(0, -1) });

    expect(g.frame).toMatchObject({
      scores: [1, 0],
      run: 1,
      best: [1, 0],
      phase: 'colour',
      reds: 5,
    });
  });
  it('rejects impossible actions and corrections', () => {
    for (const action of [
      { type: 'pot', ball: 1, count: 7 },
      { type: 'foul', penalty: 8, removed: 0, next: 1 },
      { ...correct, reds: 3 },
      { ...correct, scores: [-1, 2] },
      { ...correct, run: 100 },
      { type: 'restore' },
    ] as Action[]) {
      expect(() => run(action)).toThrow();
    }
  });
});
describe('backup and schema', () => {
  it('merges new matches and skips identical copies regardless of field order', () => {
    const m = append(createMatch(setup), { type: 'finish', winner: 0 });
    const original = { ...emptyLibrary(), matches: [m] };
    const result = mergeBackup(emptyLibrary(), exportBackup(original));

    expect(result.matches).toEqual([m]);
    expect(mergeBackup(result, exportBackup(original)).matches).toHaveLength(1);
  });
  it('rejects divergent records atomically', () => {
    const m = createMatch(setup);
    const library = { ...emptyLibrary(), matches: [m] };
    const changed = append(m, { type: 'pot', ball: 1, count: 1 });

    expect(() => mergeBackup(library, exportBackup({ ...library, matches: [changed] }))).toThrow(
      'Конфликт',
    );
    expect(library.matches[0].events).toEqual([]);
  });
  it('rejects a second active match, invalid events and future versions', () => {
    const m = createMatch(setup);
    const library = { ...emptyLibrary(), matches: [m] };

    expect(() =>
      mergeBackup(library, exportBackup({ ...library, matches: [createMatch(setup)] })),
    ).toThrow('незавершённый');
    expect(validMatch({ ...m, version: 2 })).toBe(false);
    expect(
      validMatch({
        ...m,
        events: [{ at: m.createdAt, action: { type: 'pot', ball: 7, count: 1 } }],
      }),
    ).toBe(false);
    expect(validLibrary({ ...library, matches: [m, m] })).toBe(false);
    expect(() => mergeBackup(library, '{"application":"snooker-score","version":99}')).toThrow();
  });
});
