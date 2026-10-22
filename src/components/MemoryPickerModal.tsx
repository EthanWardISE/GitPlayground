import type { PhotoDocument } from '../types/database';

type MemoryPickerModalProps = {
	photos: PhotoDocument[];
	onSelect: (photo: PhotoDocument) => void;
	onClose: () => void;
};

export default function MemoryPickerModal({ photos, onSelect, onClose }: MemoryPickerModalProps) {
	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-kinfolk-ink/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<section className="memory-picker-panel max-h-[min(720px,90vh)] w-full max-w-3xl overflow-hidden rounded-4xl p-6 shadow-soft" role="dialog" aria-modal="true" aria-labelledby="memory-picker-title">
				<header className="mb-5 flex items-start justify-between">
					<div><p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-kinfolk-muted">From the family archive</p><h2 id="memory-picker-title" className="font-serif text-3xl text-kinfolk-ink">Share a memory</h2></div>
					<button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-2xl text-kinfolk-muted hover:bg-kinfolk-linen" aria-label="Close memory picker">×</button>
				</header>
				{photos.length ? <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">{photos.map((photo) => <button type="button" key={photo.$id} onClick={() => onSelect(photo)} className="group overflow-hidden rounded-2xl bg-kinfolk-linen text-left focus:outline-none focus:ring-2 focus:ring-kinfolk-moss"><img src={photo.imageUrl} alt={photo.title || `Family memory from ${photo.year}`} className="aspect-square w-full object-cover transition group-hover:scale-105" /><span className="block truncate px-3 py-2 text-sm text-kinfolk-ink">{photo.title || photo.year}</span></button>)}</div> : <p className="rounded-2xl bg-kinfolk-linen p-8 text-center text-kinfolk-muted">There are no family memories to share yet.</p>}
			</section>
		</div>
	);
}
