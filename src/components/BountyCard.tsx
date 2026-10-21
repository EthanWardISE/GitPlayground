import type { Bounty } from '../lib/bounties';

export default function BountyCard({ bounty, onFulfill, onDelete }: { bounty: Bounty; onFulfill?: (bounty: Bounty) => void; onDelete?: (bounty: Bounty) => void }) {
	const resolved = bounty.status === 'resolved';
	return (
		<article className={`bounty-card ${resolved ? 'bounty-card-resolved' : ''}`}>
			<div className="bounty-card-top"><span className="bounty-status">{resolved ? 'FULFILLED' : 'OPEN REQUEST'}</span><time dateTime={bounty.created_at}>{new Date(bounty.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>
			<h2>{bounty.title}</h2>
			<p>{bounty.description}</p>
			<div className="bounty-people"><span>Asked by <strong>{bounty.requesterName}</strong></span>{bounty.submissions.length > 0 && <span>Found by <strong>{[...new Set(bounty.submissions.map((submission) => submission.submitterName))].join(', ')}</strong></span>}</div>
			{resolved && <div className="bounty-photo-strip">{bounty.submissions.map((submission) => <img key={submission.id} src={submission.photo.imageUrl} alt={submission.photo.title || `Fulfilled memory from ${submission.photo.year}`} loading="lazy" />)}</div>}
			{!resolved && onFulfill && <button className="button button-primary bounty-fulfill" type="button" onClick={() => onFulfill(bounty)}>I found this memory</button>}
			{onDelete && <button className="text-link bounty-delete" type="button" onClick={() => onDelete(bounty)}>Delete {resolved ? 'fulfilled memory' : 'request'}</button>}
		</article>
	);
}
