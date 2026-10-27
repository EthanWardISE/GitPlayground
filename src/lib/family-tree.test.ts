import { describe, expect, it } from 'vitest';
import { ageFor, toEdge } from './family-tree';
import type { PersonRelationshipRow } from '../types/database';

describe('ageFor', () => {
  const today = new Date(2026, 9, 27);
  it.each([
    ['2000-10-28', 25],
    ['2000-10-27', 26],
    ['2000-10-26', 26],
    ['2000-11-01', 25],
    ['2026-10-27', 0],
    ['2026-10-28', null],
    ['2027-01-01', null],
    ['invalid', null],
    [undefined, null],
  ] as const)('returns %s birth date age as %s', (birthDate, expected) => {
    expect(ageFor({ $id: 'person', name: 'Alex', birthDate }, today)).toBe(expected);
  });
});

describe('toEdge', () => {
  const relationship: PersonRelationshipRow = {
    id: 'relationship', family_id: 'family', person_a: 'a', person_b: 'b',
    relationship_type: 'parent', connection_source: null, source_handle: 'bottom-source',
    target_handle: 'top-target', started_on: null, ended_on: null,
    created_by: null, created_at: '2026-01-01',
  };
  it.each(['parent', 'step_parent', 'guardian'] as const)('directs %s from person b to person a', (relationship_type) => {
    expect(toEdge({ ...relationship, relationship_type })).toMatchObject({ source: 'b', target: 'a' });
  });
  it.each(['spouse', 'sibling'] as const)('directs %s from person a to person b', (relationship_type) => {
    expect(toEdge({ ...relationship, relationship_type })).toMatchObject({ source: 'a', target: 'b' });
  });
  it('respects an explicit source and preserves connection handles', () => {
    expect(toEdge({ ...relationship, connection_source: 'a' })).toMatchObject({
      id: 'relationship', source: 'a', target: 'b', sourceHandle: 'bottom-source', targetHandle: 'top-target',
    });
  });
  it('labels ended marriages and preserves the end date', () => {
    expect(toEdge({ ...relationship, relationship_type: 'spouse', ended_on: '2025-01-01' })).toMatchObject({
      label: 'Former spouse', data: { relationshipType: 'spouse', endedOn: '2025-01-01' },
    });
  });
  it('labels ended non-marital relationships', () => {
    expect(toEdge({ ...relationship, ended_on: '2025-01-01' }).label).toBe('Parent · ended');
  });
});
