/**
 * Analytics and statistics utilities
 */

import { prisma } from './db';
import type { Prisma } from '@prisma/client';

export interface CardStats {
  totalScans: number;
  nfcScans: number;
  qrScans: number;
  sentimentChecks: number;
  positiveSentiment: number;
  negativeSentiment: number;
  neutralSentiment: number;
  successfulRedirects: number;
  failedRedirects: number;
  conversionRate: number; // scans to reviews
}

export interface ProfileStats extends CardStats {
  profileId: string;
  profileName: string;
  cardCount: number;
}

export interface BusinessStats {
  businessId: string;
  totalScans: number;
  totalReviews: number;
  averageConversionRate: number;
  profileStats: ProfileStats[];
  topCards: Array<{
    cardId: string;
    cardName: string;
    scanCount: number;
  }>;
}

/**
 * Get statistics for a specific card
 */
export async function getCardStats(
  cardId: string,
  startDate?: Date,
  endDate?: Date
): Promise<CardStats> {
  const whereClause: Prisma.ScanWhereInput = {
    cardId,
  };

  if (startDate || endDate) {
    whereClause.timestamp = {};
    if (startDate) whereClause.timestamp.gte = startDate;
    if (endDate) whereClause.timestamp.lte = endDate;
  }

  const scans = await prisma.scan.findMany({
    where: whereClause,
    include: {
      sentimentChecks: true,
      reviewRedirects: true,
    },
  });

  const totalScans = scans.length;
  const nfcScans = scans.filter((s) => s.scanType === 'nfc').length;
  const qrScans = scans.filter((s) => s.scanType === 'qr').length;

  const sentimentChecks = scans.flatMap((s) => s.sentimentChecks);
  const positiveSentiment = sentimentChecks.filter((s) => s.sentiment === 'positive').length;
  const negativeSentiment = sentimentChecks.filter((s) => s.sentiment === 'negative').length;
  const neutralSentiment = sentimentChecks.filter((s) => s.sentiment === 'neutral').length;

  const reviewRedirects = scans.flatMap((s) => s.reviewRedirects);
  const successfulRedirects = reviewRedirects.filter((r) => r.successful).length;
  const failedRedirects = reviewRedirects.filter((r) => !r.successful).length;

  const conversionRate = totalScans > 0 ? successfulRedirects / totalScans : 0;

  return {
    totalScans,
    nfcScans,
    qrScans,
    sentimentChecks: sentimentChecks.length,
    positiveSentiment,
    negativeSentiment,
    neutralSentiment,
    successfulRedirects,
    failedRedirects,
    conversionRate,
  };
}

/**
 * Get statistics for a Google Business Profile
 */
export async function getProfileStats(
  profileId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ProfileStats> {
  const profile = await prisma.googleBusinessProfile.findUnique({
    where: { id: profileId },
    include: {
      cards: {
        include: {
          scans: {
            where: startDate || endDate
              ? {
                  timestamp: {
                    ...(startDate && { gte: startDate }),
                    ...(endDate && { lte: endDate }),
                  },
                }
              : undefined,
            include: {
              sentimentChecks: true,
              reviewRedirects: true,
            },
          },
        },
      },
    },
  });

  if (!profile) {
    throw new Error('Profile not found');
  }

  const allScans = profile.cards.flatMap((card) => card.scans);
  const totalScans = allScans.length;
  const nfcScans = allScans.filter((s) => s.scanType === 'nfc').length;
  const qrScans = allScans.filter((s) => s.scanType === 'qr').length;

  const allSentimentChecks = allScans.flatMap((s) => s.sentimentChecks);
  const positiveSentiment = allSentimentChecks.filter((s) => s.sentiment === 'positive').length;
  const negativeSentiment = allSentimentChecks.filter((s) => s.sentiment === 'negative').length;
  const neutralSentiment = allSentimentChecks.filter((s) => s.sentiment === 'neutral').length;

  const allRedirects = allScans.flatMap((s) => s.reviewRedirects);
  const successfulRedirects = allRedirects.filter((r) => r.successful).length;
  const failedRedirects = allRedirects.filter((r) => !r.successful).length;

  const conversionRate = totalScans > 0 ? successfulRedirects / totalScans : 0;

  return {
    profileId: profile.id,
    profileName: profile.profileName,
    cardCount: profile.cards.length,
    totalScans,
    nfcScans,
    qrScans,
    sentimentChecks: allSentimentChecks.length,
    positiveSentiment,
    negativeSentiment,
    neutralSentiment,
    successfulRedirects,
    failedRedirects,
    conversionRate,
  };
}

/**
 * Get statistics for a business
 */
export async function getBusinessStats(
  businessId: string,
  startDate?: Date,
  endDate?: Date
): Promise<BusinessStats> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      profiles: {
        include: {
          cards: {
            include: {
              scans: {
                where: startDate || endDate
                  ? {
                      timestamp: {
                        ...(startDate && { gte: startDate }),
                        ...(endDate && { lte: endDate }),
                      },
                    }
                  : undefined,
                include: {
                  reviewRedirects: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!business) {
    throw new Error('Business not found');
  }

  const profileStats: ProfileStats[] = await Promise.all(
    business.profiles.map((profile) => getProfileStats(profile.id, startDate, endDate))
  );

  const allScans = business.profiles.flatMap((profile) =>
    profile.cards.flatMap((card) => card.scans)
  );
  const totalScans = allScans.length;
  const totalReviews = allScans.flatMap((s) => s.reviewRedirects).filter((r) => r.successful).length;
  const averageConversionRate =
    profileStats.length > 0
      ? profileStats.reduce((sum, p) => sum + p.conversionRate, 0) / profileStats.length
      : 0;

  const cardScanCounts = business.profiles.flatMap((profile) =>
    profile.cards.map((card) => ({
      cardId: card.id,
      cardName: card.name,
      scanCount: card.scans.length,
    }))
  );

  const topCards = cardScanCounts
    .sort((a, b) => b.scanCount - a.scanCount)
    .slice(0, 10);

  return {
    businessId: business.id,
    totalScans,
    totalReviews,
    averageConversionRate,
    profileStats,
    topCards,
  };
}

