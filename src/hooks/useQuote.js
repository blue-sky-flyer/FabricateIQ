import { useState } from 'react';
import { fetchAIQuote, buildQuotePrompt } from '../services/api.js';

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
      setAiQuote(data.quote);
      setQuoteVersions([{ quote: data.quote, label: 'Original' }]);
      return data.quote;
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
