/**
 * Main App Component
 */

import React, { useState } from "react";
import { greet } from "@repliql/repliql";

export function App(): React.ReactElement {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState(greet("Playground"));

  const handleGreet = () => {
    setMessage(greet(`User #${count + 1}`));
    setCount((prev) => prev + 1);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>🎯 RepliQL Playground</h1>
        <p className="subtitle">Test your offline-first URQL caching solution</p>
      </header>

      <section className="section">
        <div className="card">
          <h2>Welcome to RepliQL</h2>
          <p className="message">{message}</p>
          <button className="button" onClick={handleGreet}>
            Greet Me ({count})
          </button>
        </div>

        <div className="card info-card">
          <h3>Features</h3>
          <ul>
            <li>✅ Offline-first caching</li>
            <li>✅ URQL integration</li>
            <li>✅ Normalized cache</li>
            <li>✅ TypeScript support</li>
          </ul>
        </div>
      </section>

      <footer className="footer">
        <p>Built with Bun, React, and TypeScript</p>
      </footer>
    </div>
  );
}
