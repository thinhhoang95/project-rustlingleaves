'use client';

import { useState } from "react";

export default function ChatPanel() {
  const [message, setMessage] = useState("");

  return (
    <aside className="chat-panel" aria-label="Agent chat panel">
      <div className="chat-messages">
        <div className="chat-bubble chat-bubble-agent">
          <p>
            <strong>Agent:</strong> For AA1801, which is a narrow-body, AMAN tells me that it needs to gain 4
            minutes to avoid LOS near RIVET. I&apos;m considering adjusting the speed of -5kts on the
            YUPRU-JASPA leg.
          </p>
          <p>Solved with SIMAP.</p>
        </div>

        <div className="chat-bubble chat-bubble-agent">
          <p>
            <strong>Agent:</strong> Yes I see that the solution is feasible with -4.43 kts so -5kts works.
            Let me check if there are other LOS events.
          </p>
        </div>

        <div className="chat-bubble chat-bubble-status" role="status" aria-live="polite">
          <span className="chat-status-check" aria-hidden="true">
            ✓
          </span>
          <span>No LOS Events found.</span>
        </div>
      </div>

      <input
        id="chat-input"
        className="chat-input"
        type="text"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Ask Agent..."
      />
    </aside>
  );
}
