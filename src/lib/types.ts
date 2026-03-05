import type { Timestamp } from 'firebase/firestore';

export type UserProfile = {
  uid: string;
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
};

export type Person = {
  id: string;
  userId: string;
  treeId: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'other';
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  status: 'alive' | 'deceased' | 'unknown';
  photoURL?: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type Relationship = {
  id: string;
  userId: string;
  treeId: string;
  personAId: string;
  personBId: string;
  relationshipType: 'parent' | 'spouse' | 'adoptive_parent' | 'step_parent';
  startDate?: string;
  endDate?: string;
  notes?: string;
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
};
