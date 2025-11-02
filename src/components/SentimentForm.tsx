import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SentimentFormProps {
  cardId: string;
  googleReviewUrl: string;
}

interface SentimentResult {
  allowed: boolean;
  message: string;
  sentiment: string;
}

export default function SentimentForm({ cardId, googleReviewUrl }: SentimentFormProps) {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SentimentResult | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);

  // Create scan on component mount
  useEffect(() => {
    const createScan = async () => {
      try {
        const scanResponse = await fetch('/.netlify/functions/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId,
            scanType: 'qr', // Default to QR, could be detected from referrer or user agent
          }),
        });

        if (scanResponse.ok) {
          const scanData = await scanResponse.json();
          setScanId(scanData.id);
        } else if (cardId === 'demo-card-id') {
          // For demo mode, use a mock scan ID
          setScanId('demo-scan-id');
        }
      } catch (error) {
        console.error('Error creating scan:', error);
        // For demo mode, use a mock scan ID
        if (cardId === 'demo-card-id') {
          setScanId('demo-scan-id');
        }
      }
    };

    createScan();
  }, [cardId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim() || !scanId) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let sentimentData;
      
      // Demo mode - simulate sentiment check
      if (cardId === 'demo-card-id') {
        // Simple demo logic: if feedback contains negative words, block it
        const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'hate', 'disappointed'];
        const lowerFeedback = feedback.toLowerCase();
        const hasNegative = negativeWords.some(word => lowerFeedback.includes(word));
        
        if (hasNegative) {
          sentimentData = {
            allowed: false,
            message: 'We appreciate your feedback. Our team will review your concerns and get back to you.',
            sentiment: 'negative',
          };
        } else {
          sentimentData = {
            allowed: true,
            message: 'Thank you for your positive feedback! You can now leave a review.',
            sentiment: 'positive',
          };
        }
      } else {
        // Real mode - check sentiment via API
        const sentimentResponse = await fetch('/.netlify/functions/sentiment-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId,
            scanId: scanId,
            feedback,
          }),
        });

        if (!sentimentResponse.ok) {
          throw new Error('Failed to check sentiment');
        }

        sentimentData = await sentimentResponse.json();
      }

      setResult({
        allowed: sentimentData.allowed,
        message: sentimentData.message,
        sentiment: sentimentData.sentiment,
      });
    } catch (error) {
      console.error('Error:', error);
      setResult({
        allowed: false,
        message: 'An error occurred. Please try again.',
        sentiment: 'neutral',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = () => {
    if (scanId) {
      // Log review redirect
      fetch('/.netlify/functions/review-redirect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          scanId,
          successful: true,
        }),
      }).catch(console.error);
    }
    
    // Redirect to Google Review
    window.location.href = googleReviewUrl;
  };

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {!result ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="feedback"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
              >
                How was your experience?
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                placeholder="Share your thoughts..."
                required
              />
            </div>
            <motion.button
              type="submit"
              disabled={loading || !feedback.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? 'Analyzing...' : 'Continue to Review'}
            </motion.button>
          </motion.form>
        ) : result.allowed ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4 text-center"
          >
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-green-800 dark:text-green-200 mb-4">{result.message}</p>
              <motion.button
                onClick={handleReviewClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <span>Leave a Google Review</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="feedback"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center"
          >
            <p className="text-yellow-800 dark:text-yellow-200">{result.message}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Our team will reach out to address your concerns.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

