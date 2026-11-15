'use client';

import { useState } from 'react';

export default function AdminUnlock({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!code.trim() || pending) return;
    setPending(true);
    setError('');
    try {
      const res = await fetch('/api/admin/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        setError('Wrong code');
        setPending(false);
        return;
      }
      onUnlocked();
    } catch {
      setError('Could not unlock');
      setPending(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
        className="app-input"
        placeholder="Admin code"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus
      />
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={pending || !code.trim()}
        className={pending || !code.trim() ? 'app-btn-disabled' : 'app-btn-success'}
      >
        {pending ? 'Checking...' : 'Unlock'}
      </button>
    </form>
  );
}
