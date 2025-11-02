import { Handler } from '@netlify/functions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Sentiment = 'positive' | 'negative' | 'neutral';

interface SentimentResult {
  sentiment: Sentiment;
  score: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
}

/**
 * Simple keyword-based sentiment analysis (fallback)
 */
function analyzeSentimentSimple(text: string): SentimentResult {
  const lowerText = text.toLowerCase();

  const positiveWords = [
    'great',
    'excellent',
    'amazing',
    'wonderful',
    'fantastic',
    'love',
    'best',
    'good',
    'perfect',
    'awesome',
    'satisfied',
    'happy',
    'pleased',
    'impressed',
  ];

  const negativeWords = [
    'terrible',
    'awful',
    'bad',
    'horrible',
    'worst',
    'hate',
    'disappointed',
    'poor',
    'unsatisfied',
    'disgusting',
    'rude',
    'slow',
    'broken',
    'waste',
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveWords.forEach((word) => {
    if (lowerText.includes(word)) positiveCount++;
  });

  negativeWords.forEach((word) => {
    if (lowerText.includes(word)) negativeCount++;
  });

  const total = positiveCount + negativeCount;

  if (total === 0) {
    return {
      sentiment: 'neutral',
      score: 0.5,
      confidence: 0.3,
    };
  }

  const positiveRatio = positiveCount / total;
  const negativeRatio = negativeCount / total;

  if (positiveRatio > negativeRatio) {
    return {
      sentiment: 'positive',
      score: 0.5 + positiveRatio * 0.5,
      confidence: Math.min(total / 5, 1.0),
    };
  } else if (negativeRatio > positiveRatio) {
    return {
      sentiment: 'negative',
      score: negativeRatio * 0.5,
      confidence: Math.min(total / 5, 1.0),
    };
  }

  return {
    sentiment: 'neutral',
    score: 0.5,
    confidence: 0.5,
  };
}

/**
 * Analyze sentiment using OpenAI API
 */
async function analyzeSentiment(text: string, apiKey?: string): Promise<SentimentResult> {
  if (!apiKey) {
    // Fallback: simple keyword-based sentiment (for development/testing)
    return analyzeSentimentSimple(text);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a sentiment analysis tool. Analyze the sentiment of the following text and respond with ONLY a JSON object in this exact format: {"sentiment": "positive" | "negative" | "neutral", "score": 0.0-1.0, "confidence": 0.0-1.0}. Score should be closer to 1.0 for very positive, 0.0 for very negative, and 0.5 for neutral.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    return {
      sentiment: result.sentiment as Sentiment,
      score: parseFloat(result.score) || 0.5,
      confidence: parseFloat(result.confidence) || 0.5,
    };
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    // Fallback to simple analysis
    return analyzeSentimentSimple(text);
  }
}

/**
 * Determine if a sentiment result should allow the user to proceed to review
 */
function shouldAllowReview(sentimentResult: SentimentResult): boolean {
  // Allow if sentiment is positive or neutral
  // Only block if clearly negative with high confidence
  if (sentimentResult.sentiment === 'negative' && sentimentResult.confidence > 0.7 && sentimentResult.score < 0.3) {
    return false;
  }
  return true;
}

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
    const { cardId, scanId, feedback } = JSON.parse(event.body || '{}');

    if (!cardId || !scanId || !feedback) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: cardId, scanId, feedback' }),
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

    // Analyze sentiment
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const sentimentResult = await analyzeSentiment(feedback, openaiApiKey);
    const allowed = shouldAllowReview(sentimentResult);

    // Save sentiment check to database
    const sentimentCheck = await prisma.sentimentCheck.create({
      data: {
        cardId,
        scanId,
        sentiment: sentimentResult.sentiment,
        sentimentScore: sentimentResult.score,
        feedback,
        allowed,
      },
    });

    // Generate appropriate message
    let message: string;
    if (allowed) {
      message = 'Thank you for your positive feedback! You can now leave a review.';
    } else {
      message = 'We appreciate your feedback. Our team will review your concerns and get back to you.';
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        allowed,
        message,
        sentiment: sentimentResult.sentiment,
        score: sentimentResult.score,
        confidence: sentimentResult.confidence,
      }),
    };
  } catch (error) {
    console.error('Error checking sentiment:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Failed to check sentiment' }),
    };
  } finally {
    await prisma.$disconnect();
  }
};

