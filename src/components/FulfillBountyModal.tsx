import { useState, type FormEvent } from 'react';
import { createBountyPhotobook, resolveBounty, submitExistingPhotos, uploadAndSubmitPhotos, type Bounty } from '../lib/bounties';
import { getSupabaseErrorMessage } from '../lib/supabase';
import type { PhotoDocument } from '../types/database';

export default function FulfillBountyModal({ bounty, photos, userId, onClose, onSubmitted }: {
	bounty: Bounty;
	photos: PhotoDocument[];
	userId: string;
	onClose: () => void;
	onSubmitted: (photoIds: string[]) => void;
}) {
	const [mode, setMode] = useState<'existing' | 'upload'>('existing');
	const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
	const [files, setFiles] = useState<File[]>([]);
	const [photobook, setPhotobook] = useState(false);
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setSaving(true);
		setError('');
		try {
			let photoIds = selectedPhotoIds;
			if (mode === 'existing') {
				if (!photoIds.length) throw new Error('Choose at least one photo before submitting.');
				await submitExistingPhotos(bounty.id, photoIds, userId);
			} else {
				if (!files.length) throw new Error('Choose at least one image before submitting.');
				const result = await uploadAndSubmitPhotos(bounty.id, userId, files, Number(form.get('year')), String(form.get('title') ?? ''));
				photoIds = result.photos.map((photo) => photo.id);
			}
			await resolveBounty(bounty.id);
			if (photobook) await createBountyPhotobook(`${bounty.title} — memories`, photoIds, userId);
			onSubmitted(photoIds);
		} catch (submitError) {
			setError(getSupabaseErrorMessage(submitError, 'Could not submit these memories.'));
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="modal-card bounty-modal" role="dialog" aria-modal="true" aria-labelledby="fulfill-bounty-heading">
				<header className="modal-header"><div><div className="eyebrow">A memory for the family</div><h2 id="fulfill-bounty-heading">Share the missing moment</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></header>
				<div className="bounty-modal-request"><strong>{bounty.title}</strong><span>{bounty.description}</span></div>
				<div className="bounty-mode-switch" role="tablist" aria-label="Choose a photo source"><button type="button" className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>Choose from album</button><button type="button" className={mode === 'upload' ? 'active' : ''} onClick={() => setMode('upload')}>Upload new photos</button></div>
				<form className="upload-form" onSubmit={submit}>
					{mode === 'existing' ? (
						<label>Photos from your album
							<select multiple size={Math.min(6, Math.max(3, photos.length))} value={selectedPhotoIds} onChange={(event) => setSelectedPhotoIds(Array.from(event.target.selectedOptions, (option) => option.value))} required>
								{photos.filter((photo) => photo.uploadedBy === userId).map((photo) => <option key={photo.$id} value={photo.$id}>{photo.title || `Memory from ${photo.year}`}</option>)}
							</select>
						</label>
					) : <><label>Choose one or more images<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} required /></label><div className="form-two"><label>Title (optional)<input name="title" placeholder="The kitchen, mid-renovation" /></label><label>Year<input name="year" type="number" min="1800" max={new Date().getFullYear()} defaultValue={new Date().getFullYear()} required /></label></div></>}
					<label className={`photobook-option ${photobook ? 'selected' : ''}`}>
						<input type="checkbox" checked={photobook} onChange={(event) => setPhotobook(event.target.checked)} />
						<span className="photobook-icon" aria-hidden="true">▤</span>
						<span className="photobook-copy"><strong>Create a photobook</strong><small>Keep these memories together in Family photobooks.</small></span>
						<span className="photobook-check" aria-hidden="true">{photobook ? '✓' : ''}</span>
					</label>
					{error && <p className="form-error" role="alert">{error}</p>}
					<div className="modal-actions"><button className="button button-quiet" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving memories…' : `Submit ${mode === 'existing' ? selectedPhotoIds.length || '' : files.length || ''} ${(mode === 'existing' ? selectedPhotoIds.length : files.length) === 1 ? 'memory' : 'memories'}`}</button></div>
				</form>
			</section>
		</div>
	);
}
