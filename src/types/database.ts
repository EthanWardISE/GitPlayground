export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type ProfileRow = {
	id: string;
	name: string;
	avatar_file_path: string | null;
	birth_year: number | null;
	parent_id1: string | null;
	parent_id2: string | null;
	created_at: string;
};

export type PhotoRow = {
	id: string;
	title: string | null;
	file_path: string;
	year: number;
	uploaded_by: string;
	tagged_profiles: string[];
	created_at: string;
};

export type CommentRow = {
	id: string;
	photo_id: string;
	author_id: string;
	author_name: string;
	content: string;
	created_at: string;
};

export interface ProfileDocument {
	$id: string;
	name: string;
	avatarFileId?: string;
	birthYear?: number;
	parentId1?: string;
	parentId2?: string;
}

export interface PhotoDocument {
	$id: string;
	title?: string;
	fileId: string;
	year: number;
	uploadedBy: string;
	taggedProfiles: string[];
	imageUrl: string;
}

export interface CommentDocument {
	$id: string;
	photoId: string;
	authorId: string;
	authorName: string;
	content: string;
	createdAt: string;
}

export interface Database {
	public: {
		Tables: {
			family_members: {
				Row: {
					user_id: string;
					full_name: string;
					role: 'admin' | 'member';
					created_at: string;
				};
				Insert: {
					user_id: string;
					full_name: string;
					role?: 'admin' | 'member';
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['family_members']['Insert']>;
				Relationships: [];
			};
			profiles: {
				Row: ProfileRow;
				Insert: {
					id?: string;
					name: string;
					avatar_file_path?: string | null;
					birth_year?: number | null;
					parent_id1?: string | null;
					parent_id2?: string | null;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
				Relationships: [];
			};
			photos: {
				Row: PhotoRow;
				Insert: {
					id?: string;
					title?: string | null;
					file_path: string;
					year: number;
					uploaded_by: string;
					tagged_profiles?: string[];
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['photos']['Insert']>;
				Relationships: [];
			};
			comments: {
				Row: CommentRow;
				Insert: {
					id?: string;
					photo_id: string;
					author_id: string;
					author_name: string;
					content: string;
					created_at?: string;
				};
				Update: Partial<Database['public']['Tables']['comments']['Insert']>;
				Relationships: [];
			};
		};
		Views: { [_ in never]: never };
		Functions: {
			is_family_member: {
				Args: Record<string, never>;
				Returns: boolean;
			};
		};
		Enums: { [_ in never]: never };
		CompositeTypes: { [_ in never]: never };
	};
}
