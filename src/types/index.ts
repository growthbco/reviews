/**
 * Shared TypeScript types
 */

export interface Business {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
}

export interface GoogleBusinessProfile {
  id: string;
  businessId: string;
  profileName: string;
  googleReviewUrl: string;
  businessName: string;
  logo?: string | null;
  settings?: {
    headerText?: string;
    instructionsText?: string;
    darkMode?: boolean;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Card {
  id: string;
  businessId: string;
  googleBusinessProfileId: string;
  name: string;
  uniqueId: string;
  qrCode?: string | null;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface Scan {
  id: string;
  cardId: string;
  scanType: 'nfc' | 'qr';
  timestamp: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SentimentCheck {
  id: string;
  cardId: string;
  scanId: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  feedback: string;
  allowed: boolean;
  timestamp: Date;
}

export interface ReviewRedirect {
  id: string;
  cardId: string;
  scanId: string;
  timestamp: Date;
  successful: boolean;
}

