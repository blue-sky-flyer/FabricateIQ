import { useState } from 'react';
import { fetchAIQuote, buildQuotePrompt } from '../services/api.js';

/**
 * Normalize tax_rate to decimal form (e.g. 0.13).
 * AI sometimes returns 13 instead of 0.13.
 */
export function normalizeQuote(quote) {
  if (!quote) return quote;
  const rate = quote.tax_rate;
  if (typeof rate === 'number' && rate > 1) {
    return { ...quote, tax_rate: rate / 100 };
  }
  return quote;
}

export function useQuote() {
  const [aiQuote, setAiQuote] = useState(null);
  const [loadingAiQuote, setLoadingAiQuote] = useState(false);
  const [quoteVersions, setQuoteVersions] = useState([]);
  const [truncationWarning, setTruncationWarning] = useState(false);

  const getAIQuote = async (formState) => {
    setLoadingAiQuote(true);
    setTruncationWarning(false);

    try {
      const { promptText, wasTruncated } = buildQuotePrompt(formState);
      if (wasTruncated) setTruncationWarning(true);

      const data = await fetchAIQuote(promptText);
      const quote = normalizeQuote(data.quote);
      setAiQuote(quote);
      setQuoteVersions([{ quote, label: 'Original' }]);
      return quote;
    } finally {
      setLoadingAiQuote(false);
    }
  };

  return {
    aiQuote, setAiQuote,
    loadingAiQuote,
    quoteVersions, setQuoteVersions,
    truncationWarning,
    getAIQuote
  };
}
