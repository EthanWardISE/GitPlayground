import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createSupabaseClient } from '../lib/supabase';
import type { ChatParticipantRow, MessageReactionEmoji, MessageReactionRow, MessageReadRow, MessageRow } from '../types/database';

export type ChatMessage = MessageRow & { reads: MessageReadRow[]; reactions: MessageReactionRow[] };

export function useKinfolkChat(chatId: string | null, userId: string, participants: ChatParticipantRow[]) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [loading, setLoading] = useState(Boolean(chatId));
	const [error, setError] = useState<string | null>(null);
	const channelRef = useRef<RealtimeChannel | null>(null);

	const loadMessages = useCallback(async () => {
		if (!chatId) {
			setMessages([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		setError(null);
		const supabase = createSupabaseClient();
		const { data, error: messageError } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
		if (messageError) {
			setError(messageError.message);
			setLoading(false);
			return;
		}
		const ids = (data ?? []).map((message) => message.id);
		const [readResult, reactionResult] = await Promise.all([
			ids.length ? supabase.from('message_reads').select('*').in('message_id', ids) : Promise.resolve({ data: [], error: null }),
			ids.length ? supabase.from('message_reactions').select('*').in('message_id', ids) : Promise.resolve({ data: [], error: null }),
		]);
		if (readResult.error || reactionResult.error) {
			setError(readResult.error?.message ?? reactionResult.error?.message ?? 'Could not load message activity.');
			setLoading(false);
			return;
		}
		const readsByMessage = new Map<string, MessageReadRow[]>();
		(readResult.data ?? []).forEach((read) => readsByMessage.set(read.message_id, [...(readsByMessage.get(read.message_id) ?? []), read]));
		const reactionsByMessage = new Map<string, MessageReactionRow[]>();
		(reactionResult.data ?? []).forEach((reaction) => reactionsByMessage.set(reaction.message_id, [...(reactionsByMessage.get(reaction.message_id) ?? []), reaction]));
		setMessages((data ?? []).map((message) => ({ ...message, reads: readsByMessage.get(message.id) ?? [], reactions: reactionsByMessage.get(message.id) ?? [] })));
		setLoading(false);
	}, [chatId]);

	useEffect(() => { void loadMessages(); }, [loadMessages]);

	useEffect(() => {
		if (!chatId) return;
		const supabase = createSupabaseClient();
		const channel = supabase.channel(`kinfolk-chat:${chatId}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
				if (payload.eventType === 'INSERT') {
					const message = payload.new as MessageRow;
					setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, { ...message, reads: [], reactions: [] }]);
				} else if (payload.eventType === 'UPDATE') {
					const message = payload.new as MessageRow;
					setMessages((current) => current.map((item) => item.id === message.id ? { ...item, ...message } : item));
				}
			})
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reads' }, (payload) => {
				const read = payload.new as MessageReadRow;
				setMessages((current) => current.map((message) => message.id === read.message_id ? { ...message, reads: [...message.reads.filter((item) => item.user_id !== read.user_id), read] } : message));
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload) => {
				const reaction = (payload.eventType === 'DELETE' ? payload.old : payload.new) as MessageReactionRow;
				setMessages((current) => current.map((message) => {
					if (message.id !== reaction.message_id) return message;
					const reactions = payload.eventType === 'DELETE'
						? message.reactions.filter((item) => !(item.user_id === reaction.user_id && item.emoji === reaction.emoji))
						: [...message.reactions.filter((item) => !(item.user_id === reaction.user_id && item.emoji === reaction.emoji)), reaction];
					return { ...message, reactions };
				}));
			})
			.on('broadcast', { event: 'read-receipt' }, ({ payload }) => {
				const read = payload as MessageReadRow;
				setMessages((current) => current.map((message) => message.id === read.message_id ? { ...message, reads: [...message.reads.filter((item) => item.user_id !== read.user_id), read] } : message));
			})
			.subscribe();
		channelRef.current = channel;
		return () => { channelRef.current = null; void supabase.removeChannel(channel); };
	}, [chatId]);

	const sendMessage = useCallback(async (content: string, attachedPhotoId: string | null = null) => {
		if (!chatId || !content.trim()) return;
		const { error: sendError } = await createSupabaseClient().from('messages').insert({ chat_id: chatId, sender_id: userId, content: content.trim(), attached_photo_id: attachedPhotoId });
		if (sendError) throw sendError;
	}, [chatId, userId]);

	const markRead = useCallback(async (messageId: string) => {
		if (!chatId) return;
		const read: MessageReadRow = { message_id: messageId, user_id: userId, read_at: new Date().toISOString() };
		const { error: readError } = await createSupabaseClient().from('message_reads').upsert(read);
		if (readError) throw readError;
		if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event: 'read-receipt', payload: read });
	}, [chatId, userId]);

	const toggleReaction = useCallback(async (messageId: string, emoji: MessageReactionEmoji) => {
		const supabase = createSupabaseClient();
		const active = messages.find((message) => message.id === messageId)?.reactions.some((reaction) => reaction.user_id === userId && reaction.emoji === emoji);
		const result = active
			? await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji)
			: await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji, created_at: new Date().toISOString() });
		if (result.error) throw result.error;
	}, [messages, userId]);

	const deleteMessage = useCallback(async (messageId: string) => {
		const { error: deleteError } = await createSupabaseClient().from('messages').update({ is_deleted: true }).eq('id', messageId).eq('sender_id', userId);
		if (deleteError) throw deleteError;
		setMessages((current) => current.map((message) => message.id === messageId ? { ...message, is_deleted: true, content: '', attached_photo_id: null } : message));
	}, [userId]);

	const isReadByEveryone = useCallback((message: ChatMessage) => {
		const activeParticipants = participants.filter((participant) => participant.user_id !== message.sender_id);
		return activeParticipants.length > 0 && activeParticipants.every((participant) => message.reads.some((read) => read.user_id === participant.user_id));
	}, [participants]);

	return useMemo(() => ({ messages, loading, error, sendMessage, markRead, toggleReaction, deleteMessage, isReadByEveryone, reload: loadMessages }), [messages, loading, error, sendMessage, markRead, toggleReaction, deleteMessage, isReadByEveryone, loadMessages]);
}
