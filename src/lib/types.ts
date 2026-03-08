import type { Timestamp } from 'firebase/firestore';

export type UserProfile = {
  id: string;
  username: string;
  createdAt: Timestamp;
};

export type FamilyTree = {
  id: string;
  userId: string;
  treeName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  personCount?: number;
  relationshipCount?: number;
  ownerPersonId?: string;
  language?: 'he' | 'en';
  privacy?: 'private' | 'link' | 'public';
  shareToken?: string;
};

export type Person = {
  id:string;
  userId: string;
  treeId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  previousFirstName?: string;
  maidenName?: string;
  nickname?: string;
  gender: 'male' | 'female' | 'other';
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  status: 'alive' | 'deceased' | 'unknown';
  religion?: 'jewish' | 'christian' | 'muslim' | 'buddhist' | 'other' | '';
  countryOfResidence?: string;
  cityOfResidence?: string;
  photoURL?: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // UI-specific properties, not from DB schema directly but merged at runtime
  isLocked?: boolean;
  groupId?: string | null;
  isOwner?: boolean;
};

export type Relationship = {
  id: string;
  userId: string;
  treeId: string;
  personAId: string;
  personBId: string;
  relationshipType:
    | 'parent'
    | 'spouse'
    | 'adoptive_parent'
    | 'step_parent'
    | 'sibling'
    | 'twin'
    | 'ex_spouse'
    | 'guardian'
    | 'separated'
    | 'partner'
    | 'ex_partner'
    | 'step_sibling';
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  manuallyEdited?: boolean;
};

export type SocialLink = {
  id: string;
  personId: string;
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'website' | 'other';
  url: string;
};

export type CanvasPosition = {
  id: string;
  userId: string;
  treeId: string;
  personId: string;
  x: number;
  y: number;
  updatedAt: Timestamp;
  isLocked?: boolean;
  groupId?: string | null;
};

export type ManualEvent = {
  id: string;
  userId: string;
  treeId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  allDay: boolean;
  description?: string;
  color: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ExportedFile = {
  id: string;
  userId: string;
  treeId: string;
  treeName: string;
  fileName: string;
  fileType: 'pdf' | 'xlsx' | 'pptx' | 'png' | 'html' | 'docx' | 'jpg';
  storagePath: string | null;
  downloadURL: string | null;
  fileSizeBytes: number;
  createdAt: Timestamp;
};

export type SharedTree = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  treeId: string;
  treeName: string;
  sharedWithEmail: string;
  sharedWithUserId: string;
  createdAt: Timestamp;
  canEdit: boolean;
  // Denormalized counts for display
  personCount?: number;
  relationshipCount?: number;
};

export type PublicTree = {
  id: string; // Same as original treeId
  ownerUserId: string;
  ownerName: string;
  treeName: string;
  personCount: number;
  relationshipCount: number;
  createdAt: Timestamp;
};
