import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
	addEdge,
	Background,
	BaseEdge,
	Controls,
	EdgeLabelRenderer,
	getSmoothStepPath,
	Handle,
	Position,
	ReactFlow,
	useEdgesState,
	useNodesState,
	type Connection,
	type Edge,
	type EdgeProps,
	type Node,
	type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ProfileDocument, PersonRelationshipRow } from '../types/database';
import { createSupabaseClient } from '../lib/supabase';
import { ageFor, toEdge, relationLabels, type RelationshipType, type FamilyEdge } from '../lib/family-tree';

type PersonNodeData = {
	profile: ProfileDocument;
};
type PersonNode = Node<PersonNodeData, 'person'>;

function PersonCard({ data }: NodeProps<PersonNode>) {
	const { profile } = data;
	const age = ageFor(profile);
	return (
		<div className="family-node">
			<Handle id="top-target" type="target" position={Position.Top} />
			<Handle id="left-target" type="target" position={Position.Left} />
			{profile.avatarUrl
				? <img src={profile.avatarUrl} alt="" loading="lazy" />
				: <span className="family-node-placeholder">{profile.name.slice(0, 1).toUpperCase()}</span>}
			<span className="family-node-copy">
				<strong>{profile.name}</strong>
				<small>{age !== null ? `${age} years old` : profile.birthDate ? 'Birthday' : 'Family member'}</small>
			</span>
			<Handle id="right-source" type="source" position={Position.Right} />
			<Handle id="bottom-source" type="source" position={Position.Bottom} />
		</div>
	);
}

function RelationshipEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data,
	markerEnd,
	style,
	selected,
}: EdgeProps<FamilyEdge>) {
	const [path, labelX, labelY] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});
	const label = data?.endedOn
		? data.relationshipType === 'spouse' ? 'Former spouse' : `${relationLabels[data.relationshipType]} · ended`
		: relationLabels[data?.relationshipType ?? 'parent'];
	const fireAction = (event: ReactMouseEvent<HTMLButtonElement>, action: 'delete' | 'end') => {
		event.stopPropagation();
		window.dispatchEvent(new CustomEvent('kinfolk-relationship-action', { detail: { id, action } }));
	};

	return (
		<>
			<BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
			<EdgeLabelRenderer>
				<div
					className={selected ? 'relationship-edge-actions nodrag nopan' : 'relationship-edge-label'}
					style={{ left: 0, top: 0, zIndex: selected ? 10000 : 1, transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
				>
					<span>{label}</span>
					{selected && !data?.endedOn && <button className="relationship-end-button" type="button" aria-label="Mark relationship as ended" title="Mark as ended" onClick={(event) => fireAction(event, 'end')}>End</button>}
					{selected && <button className="relationship-delete-button" type="button" aria-label="Delete connection" title="Delete connection" onClick={(event) => fireAction(event, 'delete')}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
						</svg>
					</button>}
				</div>
			</EdgeLabelRenderer>
		</>
	);
}

const nodeTypes = { person: PersonCard };
const edgeTypes = { relationship: RelationshipEdge };
export default function FamilyTreeCanvas({ profiles }: { profiles: ProfileDocument[] }) {
	const [nodes, setNodes, onNodesChange] = useNodesState<PersonNode>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<FamilyEdge>([]);
	const [relationType, setRelationType] = useState<RelationshipType>('parent');
	const [selectedProfile, setSelectedProfile] = useState<ProfileDocument | null>(null);
	const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(true);
	const [savingPosition, setSavingPosition] = useState(false);

	const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.$id, profile])), [profiles]);

	useEffect(() => {
		let cancelled = false;
		async function loadTree() {
			setLoading(true);
			setError('');
			try {
				const supabase = createSupabaseClient();
				const [relationshipResult, positionResult] = await Promise.all([
					supabase.from('person_relationships').select('*').limit(1000),
					supabase.from('tree_positions').select('*').limit(1000),
				]);
				if (relationshipResult.error) throw relationshipResult.error;
				if (positionResult.error) throw positionResult.error;

				const positions = new Map(positionResult.data.map((position) => [position.profile_id, position]));
				const nextNodes = profiles.map((profile, index): PersonNode => {
					const position = positions.get(profile.$id);
					return {
						id: profile.$id,
						type: 'person',
						position: position
							? { x: position.x, y: position.y }
							: { x: (index % 5) * 210, y: Math.floor(index / 5) * 140 },
						data: { profile },
					};
				});
				const knownIds = new Set(profiles.map((profile) => profile.$id));
				const nextEdges = relationshipResult.data
					.filter((relationship) => knownIds.has(relationship.person_a) && knownIds.has(relationship.person_b))
					.map(toEdge);
				if (!cancelled) {
					setNodes(nextNodes);
					setEdges(nextEdges);
				}
			} catch (loadError) {
				if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load the family tree.');
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void loadTree();
		return () => { cancelled = true; };
	}, [profiles, setEdges, setNodes]);

	const onConnect = useCallback(async (connection: Connection) => {
		if (!connection.source || !connection.target || connection.source === connection.target) return;
		setError('');
		try {
			const supabase = createSupabaseClient();
			const undirected = relationType === 'spouse' || relationType === 'sibling';
			const [personA, personB] = undirected
				? [connection.source, connection.target].sort((a, b) => a.localeCompare(b))
				: [connection.target, connection.source];
			const { data, error: insertError } = await supabase
				.from('person_relationships')
				.insert({
					person_a: personA,
					person_b: personB,
					relationship_type: relationType,
					connection_source: connection.source,
					source_handle: connection.sourceHandle,
					target_handle: connection.targetHandle,
				})
				.select('*')
				.single();
			if (insertError) throw insertError;
			setEdges((current) => addEdge(toEdge(data), current));
		} catch (connectError) {
			setError(connectError instanceof Error ? connectError.message : 'Could not save this relationship.');
		}
	}, [relationType, setEdges]);

	const endRelationship = useCallback(async (edge: FamilyEdge) => {
		if (edge.data?.endedOn || !window.confirm('Mark this relationship as ended? It will remain on the family tree as history.')) return;
		setError('');
		try {
			const today = new Date();
			const endedOn = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
			const { data, error: updateError } = await createSupabaseClient()
				.from('person_relationships')
				.update({ ended_on: endedOn })
				.eq('id', edge.id)
				.select('*')
				.maybeSingle();
			if (updateError) throw updateError;
			if (!data) throw new Error('This relationship could not be updated.');
			setEdges((current) => current.map((item) => item.id === edge.id ? toEdge(data) : item));
		} catch (updateError) {
			setError(updateError instanceof Error ? updateError.message : 'Could not update this relationship.');
		}
	}, [setEdges]);

	const deleteRelationship = useCallback(async (edge: FamilyEdge) => {
		const [firstPerson, secondPerson] = [profileById.get(edge.source)?.name, profileById.get(edge.target)?.name];
		const connectionName = firstPerson && secondPerson ? `${firstPerson} and ${secondPerson}` : 'these family members';
		if (!window.confirm(`Delete the connection between ${connectionName}? This permanently removes the relationship; it will not be kept as history.`)) return;
		setError('');
		try {
			const { data, error: deleteError } = await createSupabaseClient()
				.from('person_relationships')
				.delete()
				.eq('id', edge.id)
				.select('id');
			if (deleteError) throw deleteError;
			if (!data.length) throw new Error('This connection could not be deleted. Check your family access and try again.');
			setEdges((current) => current.filter((item) => item.id !== edge.id));
			setSelectedEdgeId(null);
		} catch (deleteError) {
			setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this connection.');
		}
	}, [profileById, setEdges]);

	useEffect(() => {
		function handleRelationshipAction(event: Event) {
			const detail = (event as CustomEvent<{ id: string; action: 'delete' | 'end' }>).detail;
			const edge = edges.find((item) => item.id === detail.id);
			if (!edge) return;
			if (detail.action === 'delete') void deleteRelationship(edge);
			else void endRelationship(edge);
		}
		window.addEventListener('kinfolk-relationship-action', handleRelationshipAction);
		return () => window.removeEventListener('kinfolk-relationship-action', handleRelationshipAction);
	}, [deleteRelationship, edges, endRelationship]);

	const saveNodePosition = useCallback(async (node: PersonNode) => {
		setSavingPosition(true);
		setError('');
		try {
			const supabase = createSupabaseClient();
			const { data: userResult, error: userError } = await supabase.auth.getUser();
			if (userError) throw userError;
			if (!userResult.user) throw new Error('Sign in again to save the tree layout.');
			const { error: positionError } = await supabase.from('tree_positions').upsert({
				profile_id: node.id,
				x: node.position.x,
				y: node.position.y,
				updated_by: userResult.user.id,
			}, { onConflict: 'profile_id' });
			if (positionError) throw positionError;
		} catch (positionError) {
			setError(positionError instanceof Error ? positionError.message : 'Could not save the tree layout.');
		} finally {
			setSavingPosition(false);
		}
	}, []);

	const activeProfile = selectedProfile ? profileById.get(selectedProfile.$id) ?? selectedProfile : null;

	return (
		<div className="family-tree-layout">
			<section className="family-tree-canvas" aria-label="Interactive family tree">
				<div className="tree-toolbar">
					<label className="relationship-picker">Connect as
						<select value={relationType} onChange={(event) => setRelationType(event.target.value as RelationshipType)}>
							<option value="parent">Source is parent → target is child</option>
							<option value="step_parent">Source is step-parent → target is child</option>
							<option value="guardian">Source is guardian → target is child</option>
							<option value="spouse">Spouse</option>
							<option value="sibling">Sibling</option>
						</select>
					</label>
					{savingPosition && <span className="muted">Saving layout…</span>}
					{error && <p className="form-error" role="alert">{error}</p>}
					<span className="tree-help">Drag any green dot to connect profiles using the selected relationship. Click a line to end or delete it.</span>
				</div>
				{loading ? <div className="tree-loading">Arranging your family memories…</div> : (
					<ReactFlow
						nodes={nodes}
						edges={edges.map((edge) => ({ ...edge, selected: edge.id === selectedEdgeId }))}
						nodeTypes={nodeTypes}
						edgeTypes={edgeTypes}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onConnect={onConnect}
						onEdgeClick={(_event, edge) => setSelectedEdgeId(edge.id)}
						onPaneClick={() => setSelectedEdgeId(null)}
						onNodeDragStop={(_event, node) => { void saveNodePosition(node); }}
						onNodeClick={(_event, node) => setSelectedProfile(node.data.profile)}
						fitView
						minZoom={0.15}
						maxZoom={1.5}
					>
						<Background color="var(--tree-dots, #e9e2d5)" gap={24} />
						<Controls />
					</ReactFlow>
				)}
			</section>
			{activeProfile && (
				<aside className="person-panel" aria-label={`${activeProfile.name} profile`}>
					<button className="icon-button person-panel-close" onClick={() => setSelectedProfile(null)} aria-label="Close profile">×</button>
					{activeProfile.avatarUrl
						? <img src={activeProfile.avatarUrl} alt="" width="96" height="96" />
						: <span className="person-panel-avatar">{initials(activeProfile.name)}</span>}
					<p className="eyebrow">A member of the family</p>
					<h2>{activeProfile.name}</h2>
					<p className="muted">{ageFor(activeProfile) !== null
						? `${ageFor(activeProfile)} years old`
						: 'Age not shared'}</p>
					<a className="button button-primary" href={`/person/${activeProfile.$id}`}>View their timeline</a>
				</aside>
			)}
		</div>
	);
}

function initials(name: string) {
	return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}
