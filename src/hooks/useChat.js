import { useState, useEffect, useRef } from 'react';
import { fetchChatResponse } from '../services/api.js';
import { normalizeQuote } from './useQuote.js';

export function useChat(aiQuote, setAiQuote, setQuoteVersions) {
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatLoading]);

  const sendChatMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;

    const userMsg = { role: 'user', content: msg, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const data = await fetchChatResponse(aiQuote, msg, chatMessages);

      const assistantMsg = {
        role: 'assistant',
        content: data.response,
        whatIf: data.whatIf || false,
        updatedQuote: data.updatedQuote,
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, assistantMsg]);

      // Auto-apply unless it's a "what if"
      if (!data.whatIf && data.updatedQuote) {
        const normalized = normalizeQuote(data.updatedQuote);
        setAiQuote(normalized);
        setQuoteVersions(prev => [...prev, {
          quote: normalized,
          label: data.changesSummary || msg.substring(0, 50)
        }]);
      }
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
        timestamp: Date.now()
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const applyWhatIf = (msgIndex) => {
    const msg = chatMessages[msgIndex];
    if (msg?.updatedQuote) {
      const normalized = normalizeQuote(msg.updatedQuote);
      setAiQuote(normalized);
      setQuoteVersions(prev => [...prev, {
        quote: normalized,
        label: 'Applied what-if change'
      }]);
      setChatMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, whatIf: false, applied: true } : m
      ));
    }
  };

  const resetChat = () => {
    setChatMessages([]);
    setChatInput('');
  };

  return {
    showChat, setShowChat,
    chatMessages, setChatMessages,
    chatInput, setChatInput,
    chatLoading,
    chatEndRef,
    sendChatMessage,
    applyWhatIf,
    resetChat
  };
}
