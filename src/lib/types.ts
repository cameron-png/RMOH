
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
    createdAt: any; // Allow for string or Timestamp
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
    createdAt: any; // Allow for string or Timestamp
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
    createdAt: any; // Allow for string or Timestamp
    userId?: string; // Only for custom forms
    description?: string;
}

export interface FeedbackSubmission {
    id: string;
    userId: string;
    openHouseId: string;
    formId: string;
    submittedAt: any; // Allow for string or Timestamp
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

export interface AppSettings {
    defaultGlobalFormId?: string;
}
