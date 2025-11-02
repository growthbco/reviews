import { Handler } from '@netlify/functions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const handler: Handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { cardId, scanId, successful = true } = JSON.parse(event.body || '{}');

    if (!cardId || !scanId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: cardId, scanId' }),
      };
    }

    // Verify scan exists and belongs to card
    const scan = await prisma.scan.findFirst({
      where: {
        id: scanId,
        cardId,
      },
    });

    if (!scan) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Scan not found' }),
      };
    }

    // Log review redirect
    const reviewRedirect = await prisma.reviewRedirect.create({
      data: {
        cardId,
        scanId,
        successful,
      },
    });

    return {
      statusCode: 201,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: reviewRedirect.id,
        cardId: reviewRedirect.cardId,
        scanId: reviewRedirect.scanId,
        successful: reviewRedirect.successful,
        timestamp: reviewRedirect.timestamp,
      }),
    };
  } catch (error) {
    console.error('Error logging review redirect:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to log review redirect' }),
    };
  } finally {
    await prisma.$disconnect();
  }
};

