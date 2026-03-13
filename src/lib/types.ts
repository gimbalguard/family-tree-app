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
  coverPhotoURL?: string;
  creatorCardBacklightIntensity?: number;
  creatorCardBacklightDisabled?: boolean;
  creatorCardSize?: number;
  creatorCardDesign?: 'default' | 'tech' | 'natural' | 'elegant';
  cardBackgroundColor?: string;
  cardBorderColor?: string;
  cardBorderWidth?: number;
  canvasBackgroundColor?: string;
  cardDesign?: 'default' | 'tech' | 'natural' | 'elegant';
  applyCreatorSettingsToTwins?: boolean;
};

export type GalleryPhoto = {
  id: string;
  userId: string;
  treeId: string;
  personId: string;
  url: string;
  storagePath: string;
  createdAt: Timestamp;
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
  aliyahDate?: string;
  status: 'alive' | 'deceased' | 'unknown';
  religion?: 'jewish' | 'christian' | 'muslim' | 'buddhist' | 'other' | '';
  countryOfResidence?: string;
  cityOfResidence?: string;
  photoURL?: string;
  description?: string;
  profession?: string;
  hobby?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  socialLinks?: SocialLink[];
  gallery?: GalleryPhoto[];
  // UI-specific properties, not from DB schema directly but merged at runtime
  isLocked?: boolean;
  groupIds?: string[];
  isGroupSelected?: boolean;
  isOwner?: boolean;
  childrenCount?: number;
  siblingsCount?: number;
  grandchildrenCount?: number;
  greatGrandchildrenCount?: number;
  gen4Count?: number;
  gen5Count?: number;
  // Creator card settings applied to the owner node
  creatorCardBacklightIntensity?: number;
  creatorCardBacklightDisabled?: boolean;
  creatorCardSize?: number;
  creatorCardDesign?: 'default' | 'tech' | 'natural' | 'elegant';
  // Global styles passed down
  cardBackgroundColor?: string;
  cardBorderColor?: string;
  cardBorderWidth?: number;
  cardDesign?: 'default' | 'tech' | 'natural' | 'elegant';
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
    | 'step_sibling'
    | 'widowed';
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
  groupIds?: string[];
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
  sharedWithUserId: string | null;
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
  coverPhotoURL?: string;
};

// --- Roots Project Types ---
interface CoverPageData {
  studentPersonId?: string;
  studentName?: string;
  schoolName?: string;
  city?: string;
  grade?: string;
  teacherName?: string;
  principalName?: string;
  hebrewYear?: string;
  gregorianYear?: number;
  submissionDate?: string;
}

interface PersonalStoryData {
  nameMeaning?: string;
  nameChoiceStory?: string;
  birthStory?: string;
  personalVision?: string;
  lifeStations?: { icon: string; date: string; event: string }[];
}

interface NuclearFamilyData {
  parentsMeetingStory?: string;
  [key: string]: any; // For dynamic parent/sibling bios
}

interface GenerationData {
  [key: string]: any;
}

interface HeritageData {
  inheritedObject?: string;
  familyRecipe?: string;
  familyNameOrigin?: string;
  selectedEvents?: string[];
  [key: string]: any; // For dynamic event stories
  customHistoricalEvents?: {id: string; label: string; year: string}[];
}

export type ShapeType = 'rectangle' | 'rounded_rectangle' | 'circle' | 'ellipse' | 'triangle' | 'star' | 'star6' | 'diamond' | 'pentagon' | 'hexagon' | 'octagon' | 'heart' | 'arrow_right' | 'arrow_left' | 'speech_bubble' | 'banner' | 'cross' | 'parallelogram' | 'trapezoid' | 'line_h';
export type TextAlign = 'left' | 'center' | 'right';

export interface DesignElement {
    id: string;
    type: 'text' | 'image' | 'shape' | 'person_card' | 'icon' | 'connection_line' | 'photo_placeholder';
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    content?: string;
    personId?: string;
    fromElementId?: string;
    toElementId?: string;
    style?: {
        // Shared
        opacity?: number;
        borderRadius?: number;
        borderColor?: string;
        borderWidth?: number;
        backgroundColor?: string;
        // Text
        color?: string;
        fontSize?: number;
        fontWeight?: 'normal' | 'bold' | 'extrabold';
        fontFamily?: string;
        textAlign?: TextAlign;
        lineHeight?: number;
        // Shape
        shapeType?: ShapeType;
        // Connection Line
        lineType?: 'straight' | 'dashed' | 'dotted' | 'pcb' | 'wavy';
    };
}

export interface DesignPage {
    id: string;
    pageNumber: number;
    pageType: 'cover' | 'name' | 'personal' | 'nuclear_family' | 'roots_paternal' | 'roots_maternal' | 'roots_great' | 'heritage' | 'national_history' | 'custom';
    title: string;
    elements: DesignElement[];
    templateId: string; // references DesignTemplate
    backgroundColor?: string;
    backgroundGradient?: string;
    backgroundImage?: string;
}

export interface DesignTemplate {
    id: string;
    name: string;
    nameHebrew: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    cardBackground: string;
    textColor: string;
    mutedTextColor: string;
    titleFont: string;
    bodyFont: string;
    backgroundStyle: 'gradient' | 'paper' | 'cosmic';
    backgroundGradient: string;
    layoutStyle: 'minimal' | 'classic' | 'elegant' | 'bold' | 'nature' | 'heritage' | 'cosmic_dark' | 'playful' | 'bright';
    decorativePattern: 'none' | 'dots' | 'lines' | 'corners' | 'border' | 'diagonal';
    cardStyle: 'solid' | 'shadow' | 'outline' | 'glass' | 'colorful';
    titleStyle: 'gradient' | 'outlined' | 'solid' | 'bold_caps' | 'italic_serif' | 'handwritten';
}
export interface RootsProjectData {
  projectName?: string;
  coverPage?: CoverPageData;
  personalStory?: PersonalStoryData;
  nuclearFamily?: NuclearFamilyData;
  familyRoots?: GenerationData;
  heritage?: HeritageData;
  designData?: {
    pages: DesignPage[];
    templateId?: string;
  };
}


export type RootsProject = {
  id: string;
  userId: string;
  treeId: string;
  studentPersonId?: string;
  projectName: string;
  currentStep: number;
  projectData: RootsProjectData;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
