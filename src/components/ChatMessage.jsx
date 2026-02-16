export default function ChatMessage({ msg, index, onApplyWhatIf, onDismiss }) {
  if (msg.role === 'user') {
    return <div className="chat-bubble chat-bubble-user">{msg.content}</div>;
  }

  return (
    <div className={`chat-bubble chat-bubble-assistant${msg.whatIf ? ' what-if' : ''}`}>
      {msg.content}
      {!msg.applied && msg.whatIf && msg.updatedQuote && (
        <div className="chat-whatif-actions">
          <button className="chat-btn-apply" onClick={() => onApplyWhatIf(index)}>Apply this change</button>
          <button className="chat-btn-keep" onClick={() => onDismiss(index)}>Keep current</button>
        </div>
      )}
      {msg.updatedQuote && !msg.whatIf && !msg.dismissed && (
        <div className="chat-applied-badge">Changes applied</div>
      )}
    </div>
  );
}
