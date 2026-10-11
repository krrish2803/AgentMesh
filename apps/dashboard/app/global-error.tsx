'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090a0f',
          color: '#f1f5f9',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            padding: 24,
            borderRadius: 16,
            background: '#0f111e',
            border: '1px solid rgba(92, 53, 245, 0.5)',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>
            Application failed to load
          </h1>
          <p
            style={{
              margin: '0 0 16px',
              fontSize: 12,
              color: '#94a3b8',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}
          >
            {error?.message || 'Unexpected root layout error'}
            {error?.digest ? ` (digest: ${error.digest})` : ''}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(to right, #7053f7, #836EF9)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
