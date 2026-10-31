import { afterAll, beforeAll } from 'vitest';
import { content } from '../src/core';

/**
 * Plays this file's tests on the plain rules: no zone has a rule of its own. For tests that stack a zone's deck and
 * expect the plain deal; the zone rules have their own tests.
 */
export function plainRules() {
  const rules = content.zones.map((z) => z.rule);
  beforeAll(() => content.zones.forEach((z) => (z.rule = undefined)));
  afterAll(() => content.zones.forEach((z, i) => (z.rule = rules[i])));
}
