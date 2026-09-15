import { describe, expect, it } from 'vitest';
import { markSolved, solvedState } from './progress';

// No localStorage under vitest, so progress lives in memory for the run.
describe('progress', () => {
  it('keeps "solved with help" apart from solved alone', () => {
    expect(solvedState('a')).toBe('no');
    markSolved('a', true);
    expect(solvedState('a')).toBe('helped');
    markSolved('b');
    expect(solvedState('b')).toBe('self');
  });

  it('a win alone upgrades a helped level; a helped win never downgrades', () => {
    markSolved('c', true);
    markSolved('c');
    expect(solvedState('c')).toBe('self');
    markSolved('c', true);
    expect(solvedState('c')).toBe('self');
  });
});
