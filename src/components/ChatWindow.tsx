import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ChatParticipantRow, MessageReactionEmoji, PhotoDocument } from '../types/database';
import { useKinfolkChat } from '../hooks/useKinfolkChat';
import { createSupabaseClient } from '../lib/supabase';
import { reportChatMessage } from '../lib/kinfolk-chat';
import MemoryPickerModal from './MemoryPickerModal';
import MessageBubble from './MessageBubble';
import AppIcon from './AppIcon';

type ChatWindowProps = {
	chatId: string;
	chatName: string;
	userId: string;
	participants: ChatParticipantRow[];
	photos: PhotoDocument[];
	onOpenPhoto?: (photo: PhotoDocument) => void;
};

export default function ChatWindow({ chatId, chatName, userId, participants, photos, onOpenPhoto }: ChatWindowProps) {
	const [draft, setDraft] = useState('');
	const [sharedPhoto, setSharedPhoto] = useState<PhotoDocument | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
	const [reportReason, setReportReason] = useState('Harassment or bullying');
	const [customReportReason, setCustomReportReason] = useState('');
	const [sending, setSending] = useState(false);
	const sendingRef = useRef(false);
	const { messages, loading, sendMessage, markRead, toggleReaction, deleteMessage, isReadByEveryone } = useKinfolkChat(chatId, userId, participants);

	async function submit(event: FormEvent<HTMLFormElement> | KeyboardEvent<HTMLTextAreaElement>) {
		event.preventDefault();
		if ((!draft.trim() && !sharedPhoto) || sendingRef.current) return;
		sendingRef.current = true;
		setSending(true);
		try {
			await sendMessage(draft, sharedPhoto?.$id ?? null);
			setDraft('');
			setSharedPhoto(null);
			setError(null);
		} catch (sendError) {
			setError(sendError instanceof Error ? sendError.message : 'Could not send your message.');
		} finally {
			sendingRef.current = false;
			setSending(false);
		}
	}

	function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			void submit(event);
		}
	}

	async function report() {
		if (!reportingMessageId) return;
		const reason = reportReason === 'Other' ? customReportReason.trim() : reportReason;
		if (!reason) { setError('Please provide a reason for this report.'); return; }
		try {
			await reportChatMessage(reportingMessageId, reason);
			setError(null);
			setReportingMessageId(null);
		} catch (reportError) {
			setError(reportError instanceof Error ? reportError.message : 'Could not report this message.');
		}
	}

	return (
		<section className="flex min-h-[34rem] flex-col overflow-hidden rounded-4xl border border-kinfolk-stone bg-kinfolk-linen shadow-card">
			<header className="border-b border-kinfolk-stone bg-kinfolk-cream px-6 py-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-kinfolk-muted">A little corner of the family</p><h2 className="font-serif text-2xl text-kinfolk-ink">{chatName}</h2></header>
			<div className="flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6">{loading ? <p className="text-center text-sm text-kinfolk-muted">Opening the family conversation…</p> : messages.map((message) => <MessageBubble key={message.id} message={message} currentUserId={userId} photo={photos.find((photo) => photo.$id === message.attached_photo_id)} read={isReadByEveryone(message)} onRead={() => { if (message.sender_id !== userId) void markRead(message.id); }} onOpenPhoto={onOpenPhoto} onReport={() => { setReportingMessageId(message.id); setReportReason('Harassment or bullying'); setCustomReportReason(''); }} onReact={(emoji: MessageReactionEmoji) => void toggleReaction(message.id, emoji)} onDelete={() => void deleteMessage(message.id)} />)}</div>
			{error && <p className="px-6 pb-2 text-sm text-kinfolk-danger" role="alert">{error}</p>}
			{sharedPhoto && <div className="mx-4 mb-2 flex items-center gap-3 rounded-2xl bg-kinfolk-cream p-2 text-sm text-kinfolk-ink"><img src={sharedPhoto.imageUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /><span className="flex-1 truncate">{sharedPhoto.title || `Memory from ${sharedPhoto.year}`}</span><button type="button" onClick={() => setSharedPhoto(null)} className="px-2 text-kinfolk-muted" aria-label="Remove attached memory">×</button></div>}
			<form onSubmit={(event) => void submit(event)} className="flex items-end gap-2 border-t border-kinfolk-stone bg-kinfolk-cream p-4"><button type="button" onClick={() => setPickerOpen(true)} disabled={sending} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-kinfolk-stone text-xl text-kinfolk-moss transition hover:bg-kinfolk-linen disabled:cursor-not-allowed disabled:opacity-50" aria-label="Share a memory"><AppIcon name="image" size={19} /></button><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} rows={1} maxLength={10000} placeholder="Write something for the family…" className="min-h-11 flex-1 resize-none rounded-2xl border border-kinfolk-control bg-kinfolk-surface px-4 py-3 text-sm text-kinfolk-ink placeholder:text-kinfolk-muted outline-none focus:border-kinfolk-leaf" /><button type="submit" disabled={sending} className="rounded-full bg-kinfolk-moss px-5 py-3 text-sm font-bold text-kinfolk-on-primary transition hover:bg-kinfolk-leaf disabled:cursor-not-allowed disabled:opacity-60">{sending ? 'Sending…' : 'Send'}</button></form>
			{pickerOpen && <MemoryPickerModal photos={photos} onSelect={(photo) => { setSharedPhoto(photo); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
			{reportingMessageId && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportingMessageId(null); }}><section className="modal-card report-modal" role="dialog" aria-modal="true" aria-labelledby="report-message-title"><div className="modal-header"><div><div className="eyebrow">Keep the family space kind</div><h2 id="report-message-title">Report message</h2></div><button className="icon-button" type="button" onClick={() => setReportingMessageId(null)} aria-label="Close">×</button></div><p className="muted">Why does this message need attention?</p><div className="report-reasons">{['Harassment or bullying', 'Hateful or discriminatory content', 'Spam or scam', 'Privacy concern', 'Other'].map((reason) => <button type="button" key={reason} className={reportReason === reason ? 'active' : ''} onClick={() => setReportReason(reason)}>{reason}</button>)}</div>{reportReason === 'Other' && <textarea value={customReportReason} onChange={(event) => setCustomReportReason(event.target.value)} maxLength={1000} rows={4} placeholder="Tell the family admin what happened…" />}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={() => setReportingMessageId(null)}>Cancel</button><button className="button button-primary" type="button" onClick={() => void report()}>Send report</button></div></section></div>}
		</section>
	);
}
