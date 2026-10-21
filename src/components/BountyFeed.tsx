import { useEffect, useState, type FormEvent } from 'react';
import { createBounty, deleteBounty, fetchOpenBounties, fetchResolvedBounties, type Bounty } from '../lib/bounties';
import { getSupabaseErrorMessage } from '../lib/supabase';
import type { PhotoDocument } from '../types/database';
import BountyCard from './BountyCard';
import FulfillBountyModal from './FulfillBountyModal';

export default function BountyFeed({ photos, userId, isAdmin }: { photos: PhotoDocument[]; userId: string; isAdmin: boolean }) {
	const [tab, setTab] = useState<'open' | 'resolved'>('open');
	const [bounties, setBounties] = useState<Bounty[]>([]);
	const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
	const [showCreate, setShowCreate] = useState(false);
	const [celebrate, setCelebrate] = useState(false);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [deletingId, setDeletingId] = useState<string | null>(null);

	async function loadBounties() {
		setLoading(true);
		setError('');
		try { setBounties(tab === 'open' ? await fetchOpenBounties() : await fetchResolvedBounties()); }
		catch (loadError) { setError(getSupabaseErrorMessage(loadError, 'Could not load memory bounties.')); }
		finally { setLoading(false); }
	}
	useEffect(() => { void loadBounties(); }, [tab]);

	async function requestMemory(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const values = new FormData(form);
		setSaving(true); setError('');
		try {
			const bounty = await createBounty(String(values.get('title') ?? ''), String(values.get('description') ?? ''), userId);
			setBounties((current) => [bounty, ...current]);
			form.reset();
			setShowCreate(false);
		} catch (createError) { setError(getSupabaseErrorMessage(createError, 'Could not create the memory request.')); }
		finally { setSaving(false); }
	}

	function completed() {
		setSelectedBounty(null);
		setCelebrate(true);
		window.setTimeout(() => setCelebrate(false), 2200);
		if (tab === 'open') setBounties((current) => current.filter((bounty) => bounty.id !== selectedBounty?.id));
		void loadBounties();
	}

	async function removeBounty(bounty: Bounty) {
		const label = bounty.status === 'resolved' ? 'fulfilled memory' : 'open request';
		if (!window.confirm(`Delete this ${label}? This removes the bounty and its submission links, but does not delete the family photos.`)) return;
		setDeletingId(bounty.id);
		setError('');
		try {
			await deleteBounty(bounty.id);
			setBounties((current) => current.filter((item) => item.id !== bounty.id));
		} catch (deleteError) {
			setError(getSupabaseErrorMessage(deleteError, `Could not delete this ${label}.`));
		} finally {
			setDeletingId(null);
		}
	}

	return (
		<section className="page-body bounty-page">
			<div className="page-heading"><div><div className="eyebrow">Help fill the gaps in our story</div><h1>Memory bounties</h1><p className="muted">Ask the family for a missing moment, or be the person who finds it.</p></div><button className="button button-primary" type="button" onClick={() => setShowCreate(true)}>Request a memory</button></div>
			<div className="bounty-tabs" role="tablist"><button className={tab === 'open' ? 'active' : ''} type="button" onClick={() => setTab('open')}>Open requests</button><button className={tab === 'resolved' ? 'active' : ''} type="button" onClick={() => setTab('resolved')}>Fulfilled memories</button></div>
			{error && <p className="form-error bounty-error" role="alert">{error}</p>}
			{loading ? <p className="muted">Looking through the family requests…</p> : bounties.length ? <div className="bounty-grid">{bounties.map((bounty) => <BountyCard key={bounty.id} bounty={bounty} onFulfill={tab === 'open' ? setSelectedBounty : undefined} onDelete={deletingId || (!isAdmin && bounty.requested_by !== userId) ? undefined : removeBounty} />)}</div> : <div className="bounty-empty"><h2>{tab === 'open' ? 'No open requests yet' : 'No fulfilled memories yet'}</h2><p>{tab === 'open' ? 'Be the first to ask the family for a missing memory.' : 'When someone finds a missing moment, it will live here.'}</p></div>}
			{selectedBounty && <FulfillBountyModal bounty={selectedBounty} photos={photos} userId={userId} onClose={() => setSelectedBounty(null)} onSubmitted={completed} />}
			{showCreate && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}><section className="modal-card bounty-modal" role="dialog" aria-modal="true" aria-labelledby="request-bounty-heading"><header className="modal-header"><div><div className="eyebrow">Call in the family</div><h2 id="request-bounty-heading">Request a memory</h2></div><button className="icon-button" type="button" onClick={() => setShowCreate(false)} aria-label="Close">×</button></header><form className="upload-form" onSubmit={requestMemory}><label>What are you looking for?<input name="title" placeholder="The 1990 kitchen renovation" required maxLength={160} /></label><label>Tell the family more<textarea name="description" rows={5} placeholder="Any details, people, or places that might help…" required maxLength={4000} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Posting…' : 'Post request'}</button></div></form></section></div>}
			{celebrate && <div className="bounty-celebration" role="status" aria-live="polite"><span>✦</span><strong>Memory found!</strong><small>The family story just got a little fuller.</small></div>}
		</section>
	);
}
