/**
 * Sentiment analysis utilities
 */

export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface SentimentResult {
  sentiment: Sentiment;
  score: number; // 0.0 to 1.0
  confidence: number; // 0.0 to 1.0
}

/**
 * Analyze sentiment using OpenAI API
 */
export async function analyzeSentiment(text: string, apiKey?: string): Promise<SentimentResult> {
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
 * Determine if a sentiment result should allow the user to proceed to review
 */
export function shouldAllowReview(sentimentResult: SentimentResult): boolean {
  // Allow if sentiment is positive or neutral
  // Only block if clearly negative with high confidence
  if (sentimentResult.sentiment === 'negative' && sentimentResult.confidence > 0.7 && sentimentResult.score < 0.3) {
    return false;
  }
  return true;
}

