import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newEntries } from '../../src/lib/welcome.js';
import { tourSteps, stepLabel } from '../../src/lib/welcome.js';

const days = [{ date: '2031-01-05' }, { date: '2031-01-06' }, { date: '2031-01-07' }];

describe('Tour steps', () => {
  test('one step per new entry, in order, each complete', () => {
    const steps = tourSteps(newEntries(), { days });
    assert.equal(steps.length, newEntries().length);
    steps.forEach((s, i) => {
      assert.equal(s.id, newEntries()[i].id);
      for (const k of ['title', 'text', 'target', 'href']) assert.ok(s[k], `${s.id} has ${k}`);
    });
  });

  test('the tracks step starts on the plain schedule and reveals Filters', () => {
    const [first, second] = tourSteps(newEntries(), { days });
    assert.equal(first.href, '/schedule');
    assert.equal(first.target, 'schedule-tracks');
    assert.equal(first.reveal, 'filters');
    assert.match(second.href, /^\/sessions\/\d+$/);
    assert.equal(second.target, 'seat-button');
  });

  test('the counter reads "1 of 2"', () => {
    assert.equal(stepLabel(0, 2), '1 of 2');
    assert.equal(stepLabel(1, 2), '2 of 2');
  });
});
