
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
    isGiftEnabled?: boolean;
    giftBrandCode?: string;
    giftAmountInCents?: number;
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
  region?: 'us' | 'ca' | 'au' | 'global';
  createdAt?: Timestamp;
  lastLoginAt?: Timestamp;
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
    type: 'Manual' | 'Auto';
    status: 'Pending' | 'Sent' | 'Failed' | 'Cancelled';
    claimUrl: string | null;
    createdAt: Timestamp;
    openHouseId?: string; // Optional link to the open house
}

export interface GiftbitSettings {
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
    image_url: string;
    region_codes: string[];
}

// Represents the combined view of a gift for the admin dashboard
export interface AdminGift extends Gift {
    senderName: string;
    senderEmail: string;
    brandName?: string;
    giftbitStatus?: string; // e.g., "sent_and_not_viewed", "redeemed"
    giftbitRedeemedDate?: string | null;
}
