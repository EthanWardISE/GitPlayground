import type { Models } from 'appwrite';

export interface Profile {
	name: string;
	avatarFileId?: string;
	birthYear?: number;
	parentId1?: string;
	parentId2?: string;
}

export interface Photo {
	title?: string;
	fileId: string;
	year: number;
	uploadedBy: string;
	taggedProfiles: string[];
}

export interface Comment {
	photoId: string;
	authorId: string;
	authorName: string;
	content: string;
	createdAt?: string;
}

export interface ProfileDocument extends Models.Document, Profile {}
export interface PhotoDocument extends Models.Document, Photo {}
export interface CommentDocument extends Models.Document, Comment {}
