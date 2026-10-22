import { useEffect, useState } from 'react';
import type { ChatParticipantRow, ChatRow, FamilyMemberRow, PhotoDocument } from '../types/database';
import { createSupabaseClient, getSupabaseErrorMessage } from '../lib/supabase';
import ChatWindow from './ChatWindow';

type MessengerProps = {
	userId: string;
	familyId: string;
	photos: PhotoDocument[];
	onOpenPhoto: (photo: PhotoDocument) => void;
};

type ChatSummary = ChatRow & { participants: ChatParticipantRow[] };

export default function Messenger({ userId, familyId, photos, onOpenPhoto }: MessengerProps) {
	const [chats, setChats] = useState<ChatSummary[]>([]);
	const [members, setMembers] = useState<FamilyMemberRow[]>([]);
	const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
	const [showNewChat, setShowNewChat] = useState(false);
	const [newChatType, setNewChatType] = useState<'direct' | 'group'>('direct');
	const [groupName, setGroupName] = useState('');
	const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');

	async function loadMessenger() {
		setLoading(true);
		setError('');
		try {
			const supabase = createSupabaseClient();
			const [chatResult, memberResult] = await Promise.all([
				supabase.from('chats').select('*').eq('family_id', familyId).order('created_at', { ascending: false }),
				supabase.from('family_members').select('family_id, user_id, full_name, role, created_at').eq('family_id', familyId).order('full_name'),
			]);
			if (chatResult.error) throw chatResult.error;
			if (memberResult.error) throw memberResult.error;
			const summaries = await Promise.all((chatResult.data ?? []).map(async (chat) => {
				const { data, error: participantError } = await supabase.from('chat_participants').select('*').eq('chat_id', chat.id);
				if (participantError) throw participantError;
				return { ...chat, participants: data ?? [] };
			}));
			setChats(summaries);
			setMembers(memberResult.data ?? []);
			if (!selectedChatId && summaries[0]) setSelectedChatId(summaries[0].id);
			if (selectedChatId && !summaries.some((chat) => chat.id === selectedChatId)) setSelectedChatId(summaries[0]?.id ?? null);
		} catch (loadError) {
			setError(getSupabaseErrorMessage(loadError, 'Could not open family messages.'));
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { void loadMessenger(); }, [familyId]);

	async function createChat() {
		const selectedIds = newChatType === 'direct' ? selectedMemberIds.slice(0, 1) : selectedMemberIds;
		if (!selectedIds.length || (newChatType === 'group' && !groupName.trim())) {
			setError(newChatType === 'group' ? 'Give the group a name and choose at least one family member.' : 'Choose a family member to message.');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const supabase = createSupabaseClient();
			const { data: chat, error: chatError } = await supabase.from('chats').insert({
				family_id: familyId,
				type: newChatType,
				name: newChatType === 'group' ? groupName.trim() : null,
				created_by: userId,
			}).select('*').single();
			if (chatError) throw chatError;
			const { error: participantError } = await supabase.from('chat_participants').insert({
				chat_id: chat.id,
				user_id: userId,
				role: 'admin',
			});
			if (participantError) throw participantError;
			for (const memberId of selectedIds) {
				const { error: addError } = await supabase.rpc('add_chat_participant', {
					p_chat_id: chat.id,
					p_user_id: memberId,
					p_role: 'member',
				});
				if (addError) throw addError;
			}
			setShowNewChat(false);
			setSelectedMemberIds([]);
			setGroupName('');
			await loadMessenger();
			setSelectedChatId(chat.id);
		} catch (createError) {
			setError(getSupabaseErrorMessage(createError, 'Could not start that conversation.'));
		} finally {
			setSaving(false);
		}
	}

	function toggleMember(memberId: string) {
		setSelectedMemberIds((current) => newChatType === 'direct'
			? [memberId]
			: current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
	}

	function chatLabel(chat: ChatSummary) {
		if (chat.name) return chat.name;
		const other = chat.participants.find((participant) => participant.user_id !== userId);
		return members.find((member) => member.user_id === other?.user_id)?.full_name ?? 'Family conversation';
	}

	const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
	const availableMembers = members.filter((member) => member.user_id !== userId);

	return (
		<section className="page-body messenger-page">
			<div className="page-heading">
				<div><div className="eyebrow">Little notes between family</div><h1>Messages</h1><p className="muted">Keep the everyday stories close.</p></div>
				<button className="button button-primary" type="button" onClick={() => setShowNewChat(true)}>New conversation</button>
			</div>
			{error && <p className="form-error" role="alert">{error}</p>}
			<div className="messenger-layout">
				<aside className="messenger-list">
					<div className="eyebrow">Conversations</div>
					{loading ? <p className="muted">Gathering your conversations…</p> : chats.length ? chats.map((chat) => <button type="button" key={chat.id} onClick={() => setSelectedChatId(chat.id)} className={`messenger-list-item ${selectedChatId === chat.id ? 'active' : ''}`}><span className="avatar avatar-0">{chatLabel(chat).slice(0, 1).toUpperCase()}</span><span><strong>{chatLabel(chat)}</strong><small>{chat.type === 'group' ? 'Family group' : 'Direct message'}</small></span></button>) : <p className="muted">No conversations yet. Start one with a family member.</p>}
				</aside>
				<div className="messenger-main">{selectedChat ? <ChatWindow chatId={selectedChat.id} chatName={chatLabel(selectedChat)} userId={userId} participants={selectedChat.participants} photos={photos} onOpenPhoto={onOpenPhoto} /> : <div className="messenger-empty"><div className="eyebrow">A quiet corner for the family</div><h2>Start a conversation</h2><p>Choose a family member and send them a note, a hello, or a shared memory.</p><button className="button button-primary" type="button" onClick={() => setShowNewChat(true)}>Write a message</button></div>}</div>
			</div>
			{showNewChat && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowNewChat(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-message-heading"><div className="modal-header"><div><div className="eyebrow">Everyone in the family can start one</div><h2 id="new-message-heading">New conversation</h2></div><button className="icon-button" type="button" onClick={() => setShowNewChat(false)} aria-label="Close">×</button></div><div className="messenger-type-tabs" role="tablist"><button type="button" className={newChatType === 'direct' ? 'active' : ''} onClick={() => { setNewChatType('direct'); setSelectedMemberIds([]); }}>Direct message</button><button type="button" className={newChatType === 'group' ? 'active' : ''} onClick={() => { setNewChatType('group'); setSelectedMemberIds([]); }}>Group chat</button></div>{newChatType === 'group' && <label className="messenger-group-name">Group name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={120} placeholder="Sunday supper plans" /></label>}{availableMembers.length ? <div className="family-picker-list">{availableMembers.map((member) => <button type="button" key={member.user_id} onClick={() => toggleMember(member.user_id)} disabled={saving} className={`family-picker-item ${selectedMemberIds.includes(member.user_id) ? 'selected' : ''}`}><span className="avatar avatar-0">{member.full_name.slice(0, 1).toUpperCase()}</span><span><strong>{member.full_name}</strong><small>{member.role === 'admin' ? 'Family admin' : 'Family member'}</small></span><span className="picker-check">{selectedMemberIds.includes(member.user_id) ? '✓' : ''}</span></button>)}</div> : <p className="muted">There are no other approved family members to message yet.</p>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={() => setShowNewChat(false)}>Cancel</button><button className="button button-primary" type="button" onClick={() => void createChat()} disabled={saving}>{saving ? 'Creating…' : newChatType === 'group' ? 'Create group' : 'Start message'}</button></div></section></div>}
		</section>
	);
}
