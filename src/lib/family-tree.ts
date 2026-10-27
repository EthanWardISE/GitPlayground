import type { Edge } from '@xyflow/react';
import type { ProfileDocument, PersonRelationshipRow } from '../types/database';

export type RelationshipType = PersonRelationshipRow['relationship_type'];
export type FamilyEdge = Edge<{ relationshipType: RelationshipType; endedOn: string | null }>;

export const relationLabels: Record<RelationshipType, string> = {
	parent: 'Parent',
	step_parent: 'Step-parent',
	guardian: 'Guardian',
	spouse: 'Spouse',
	sibling: 'Sibling',
};

export function toEdge(relationship: PersonRelationshipRow): FamilyEdge {
	const directional = ['parent', 'step_parent', 'guardian'].includes(relationship.relationship_type);
	const source = relationship.connection_source
		?? (directional ? relationship.person_b : relationship.person_a);
	return {
		id: relationship.id,
		source,
		target: source === relationship.person_a ? relationship.person_b : relationship.person_a,
		sourceHandle: relationship.source_handle,
		targetHandle: relationship.target_handle,
		label: relationship.ended_on
			? relationship.relationship_type === 'spouse' ? 'Former spouse' : `${relationLabels[relationship.relationship_type]} · ended`
			: relationLabels[relationship.relationship_type],
		type: 'relationship',
		style: { stroke: relationship.ended_on ? '#b8b3a7' : '#829178', strokeWidth: 2 },
		labelStyle: { fill: '#68665d', fontSize: 11 },
		data: { relationshipType: relationship.relationship_type, endedOn: relationship.ended_on },
	};
}

export function ageFor(profile: ProfileDocument, today = new Date()) {
	if (!profile.birthDate) return null;
	const birthDate = new Date(`${profile.birthDate}T00:00:00`);
	if (Number.isNaN(birthDate.getTime())) return null;
	let age = today.getFullYear() - birthDate.getFullYear();
	if (
		today.getMonth() < birthDate.getMonth()
		|| (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
	) age -= 1;
	return age >= 0 ? age : null;
}

