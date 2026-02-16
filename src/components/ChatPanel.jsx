import ChatMessage from './ChatMessage';

export default function ChatPanel({ chat, quoteVersions }) {
  const {
    showChat, setShowChat,
    chatMessages, setChatMessages,
    chatInput, setChatInput,
    chatLoading,
    chatEndRef,
    sendChatMessage,
    applyWhatIf
  } = chat;

  const dismissWhatIf = (index) => {
    setChatMessages(prev => prev.map((m, i) =>
      i === index ? { ...m, whatIf: false, dismissed: true } : m
    ));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`chat-backdrop ${showChat ? 'visible' : ''}`}
        onClick={() => setShowChat(false)}
      />

      {/* Slide-out Panel */}
      <div className={`chat-panel ${showChat ? 'open' : ''}`}>
        <div className="chat-header">
          <div className="chat-header-left">
            <span className="chat-header-title">Adjust Your Quote</span>
            <span className="chat-version-badge">v{quoteVersions.length}</span>
          </div>
          <button className="chat-close-btn" onClick={() => setShowChat(false)} title="Close">&#10005;</button>
        </div>

        <div className="chat-messages">
          <div className="chat-welcome">
            <div className="chat-welcome-title">Your quote is ready. Ask me to adjust it:</div>
            <ul>
              <li>&ldquo;Swap the G-Floor for carpet&rdquo;</li>
              <li>&ldquo;Add 2 more lightboxes&rdquo;</li>
              <li>&ldquo;What if we use AGAM walls instead of MDF?&rdquo;</li>
              <li>&ldquo;Remove the AV package&rdquo;</li>
              <li>&ldquo;What&rsquo;s the total if we go to Montreal?&rdquo;</li>
            </ul>
          </div>

          {chatMessages.map((msg, i) => (
            <ChatMessage
              key={i}
              msg={msg}
              index={i}
              onApplyWhatIf={applyWhatIf}
              onDismiss={dismissWhatIf}
            />
          ))}

          {chatLoading && (
            <div className="chat-typing">
              <div className="chat-typing-dot"></div>
              <div className="chat-typing-dot"></div>
              <div className="chat-typing-dot"></div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-area">
          <input
            className="chat-input"
            type="text"
            placeholder="Ask to adjust your quote..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={chatLoading}
          />
          <button
            className="chat-send-btn"
            onClick={sendChatMessage}
            disabled={chatLoading || !chatInput.trim()}
          >
            {chatLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </>
  );
}
