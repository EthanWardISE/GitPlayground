import { useState } from 'react';
import type { MessageReactionEmoji, PhotoDocument } from '../types/database';
import type { ChatMessage } from '../hooks/useKinfolkChat';
import AppIcon from './AppIcon';

export const MESSAGE_REACTIONS: MessageReactionEmoji[] = ['❤️', '😂', '😊', '😮', '😢', '👏', '🙏', '🎉'];

type MessageBubbleProps = {
	message: ChatMessage;
	currentUserId: string;
	photo?: PhotoDocument;
	read: boolean;
	onRead: () => void;
	onOpenPhoto?: (photo: PhotoDocument) => void;
	onReport: () => void;
	onReact: (emoji: MessageReactionEmoji) => void;
	onDelete: () => void;
};

export default function MessageBubble({ message, currentUserId, photo, read, onRead, onOpenPhoto, onReport, onReact, onDelete }: MessageBubbleProps) {
	const [optionsOpen, setOptionsOpen] = useState(false);
	const [reactionOpen, setReactionOpen] = useState(false);
	const mine = message.sender_id === currentUserId;
	const counts = MESSAGE_REACTIONS.map((emoji) => ({ emoji, count: message.reactions.filter((reaction) => reaction.emoji === emoji).length, active: message.reactions.some((reaction) => reaction.emoji === emoji && reaction.user_id === currentUserId) })).filter((reaction) => reaction.count);

	function deleteWithConfirmation() {
		if (window.confirm('Delete this message? It will be removed for everyone in this chat.')) onDelete();
		setOptionsOpen(false);
	}

	return (
		<div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`} onMouseEnter={onRead} onClick={() => setOptionsOpen((open) => !open)}>
			<div className={`relative max-w-[min(80%,34rem)] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
				<div className={`rounded-3xl px-4 py-3 shadow-sm ${mine ? 'rounded-br-md bg-kinfolk-moss text-kinfolk-on-primary' : 'rounded-bl-md border border-kinfolk-stone bg-kinfolk-surface text-kinfolk-ink'}`}>
					{message.is_deleted ? <p className="kinfolk-message-text italic opacity-70">This memory was removed.</p> : <>
						{photo && <button type="button" onClick={(event) => { event.stopPropagation(); onOpenPhoto?.(photo); }} className="mb-2 block overflow-hidden rounded-2xl focus:outline-none focus:ring-2 focus:ring-kinfolk-peach"><img src={photo.imageUrl} alt={photo.title || `Shared family memory from ${photo.year}`} className="max-h-72 w-full object-cover" /></button>}
						{message.content && <p className="kinfolk-message-text whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>}
					</>}
				</div>
				{!message.is_deleted && <div className={`message-actions message-actions-${mine ? 'mine' : 'received'} ${optionsOpen ? 'message-actions-open' : ''}`} onClick={(event) => event.stopPropagation()}>
					<button type="button" onClick={() => setReactionOpen((open) => !open)} aria-label="React to message">☺</button>
					{mine ? <button type="button" onClick={deleteWithConfirmation} aria-label="Delete message"><AppIcon name="trash" size={15} /></button> : <button type="button" onClick={onReport} aria-label="Report message">⚑</button>}
					{reactionOpen && <div className="reaction-picker">{MESSAGE_REACTIONS.map((emoji) => <button type="button" key={emoji} onClick={() => { onReact(emoji); setReactionOpen(false); setOptionsOpen(false); }}>{emoji}</button>)}</div>}
				</div>}
				{counts.length > 0 && <div className="message-reactions">{counts.map(({ emoji, count, active }) => <button type="button" className={active ? 'active' : ''} key={emoji} onClick={(event) => { event.stopPropagation(); onReact(emoji); }}>{emoji} {count}</button>)}</div>}
				<div className={`mt-1 flex items-center gap-2 px-2 text-[11px] text-kinfolk-muted ${mine ? 'flex-row-reverse' : ''}`} onClick={(event) => event.stopPropagation()}>
					<time dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
					{mine ? <span>{read ? 'Read' : 'Sent'}</span> : <button type="button" onClick={onReport} className="opacity-0 transition group-hover:opacity-100 hover:text-kinfolk-moss">Report</button>}
				</div>
			</div>
		</div>
	);
}
