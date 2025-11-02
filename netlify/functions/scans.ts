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
    const { cardId, scanType } = JSON.parse(event.body || '{}');

    if (!cardId || !scanType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: cardId, scanType' }),
      };
    }

    // Get IP address and user agent from request
    const ipAddress =
      event.headers['x-forwarded-for']?.split(',')[0] ||
      event.headers['client-ip'] ||
      event.requestContext?.identity?.sourceIp ||
      'unknown';
    const userAgent = event.headers['user-agent'] || 'unknown';

    // Create scan
    const scan = await prisma.scan.create({
      data: {
        cardId,
        scanType,
        ipAddress,
        userAgent,
      },
    });

    return {
      statusCode: 201,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: scan.id,
        cardId: scan.cardId,
        scanType: scan.scanType,
        timestamp: scan.timestamp,
      }),
    };
  } catch (error) {
    console.error('Error creating scan:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to create scan' }),
    };
  } finally {
    await prisma.$disconnect();
  }
};

