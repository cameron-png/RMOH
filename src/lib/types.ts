import type { Timestamp } from 'firebase/firestore';

export interface Address {
    streetNumber: string;
    streetName: string;
    unitNumber?: string;
    city: string;
    state: string;
    zipCode: string;
}

export interface OpenHouse {
    id: string;
    userId: string;
    address: string;
    structuredAddress?: Address;
    createdAt: Timestamp;
    imageUrl?: string;
    isActive?: boolean;
    feedbackFormId?: string;
}

export interface Lead {
    id: string;
    userId: string;
    openHouseId: string;
    name: string;
    email?: string;
    phone?: string;
    notes?: string;
    createdAt: Timestamp;
    feedbackSubmissionId?: string;
    status: 'active' | 'deleted';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  availableBalance?: number; // in cents
  isAdmin?: boolean;
  title?: string;
  licenseNumber?: string;
  brokerageName?: string;
  defaultFormId?: string;
  photoURL?: string;
  apiKey?: string;
  personalLogoUrl?: string;
  brokerageLogoUrl?: string;
  region?: string;
}

export type User = import("firebase/auth").User & UserProfile;


export interface QuestionOption {
    id: string;
    value: string;
}

export interface Question {
    id:string;
    text: string;
    type: 'short-answer' | 'yes-no' | 'rating' | 'multiple-choice';
    options?: QuestionOption[];
}

export interface FeedbackForm {
    id: string;
    title: string;
    type: 'global' | 'custom';
    questions: Question[];
    createdAt: Timestamp;
    userId?: string; // Only for custom forms
    description?: string;
}

export interface FeedbackSubmission {
    id: string;
    userId: string;
    openHouseId: string;
    formId: string;
    submittedAt: Timestamp;
    answers: {
        questionId: string;
        questionText: string;
        questionType: string;
        answer: any;
    }[];
}

export interface Gift {
    id: string;
    userId: string;
    recipientName: string;
    recipientEmail: string;
    brandCode: string;
    amountInCents: number;
    type: string;
    status: 'Pending' | 'Available' | 'Failed';
    claimUrl: string | null;
    createdAt: Timestamp;
}

export interface GiftbitSettings {
    enabledRegionCodes?: string[];
    enabledBrandCodes?: string[];
}


export interface AppSettings {
    defaultGlobalFormId?: string;
    giftbit?: GiftbitSettings;
}

export interface GiftbitBrand {
    brand_code: string;
    name: string;
    denominations_in_cents?: number[];
    min_price_in_cents?: number;
    max_price_in_cents?: number;
    region_codes: string[]; // Although the API filters by one, the object itself tells us all it's available in
    image_url: string;
}

export interface GiftbitRegion {
    id: number;
    code: string; // The text code, e.g. "ca", "us", "au", "global"
    name: string;
    currency: string;
    image_url: string;
}
