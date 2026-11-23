import { useMemo, useRef, useState } from 'react';
import { sealSecret, secureSubmit, type PixiFormConfig, type PixiFormHandle, type Secret } from 'pixiformui';
import { PixiForm } from './PixiForm';

type Accent = 'indigo' | 'teal' | 'rose' | 'amber' | 'violet' | 'slate';

export function App() {
  const [accent, setAccent] = useState<Accent>('violet');
  const [log, setLog] = useState<string[]>([]);
  const handle = useRef<PixiFormHandle | null>(null);

  // useMemo: the form is built once; changing `accent` only re-themes it.
  const config = useMemo<PixiFormConfig>(
    () => ({
      title: 'Sign in',
      subtitle: 'React app · the form is rendered on canvas',
      fields: [
        { type: 'email', name: 'email', label: 'Email', required: true, placeholder: 'you@example.com' },
        { type: 'password', name: 'password', label: 'Password', required: true, info: 'Encrypted in the browser before sending.' },
        { type: 'otp', name: 'code', label: 'Authenticator code', length: 6, groupSize: 3, required: true },
        { type: 'checkbox', name: 'remember', label: 'Keep me signed in' },
      ],
      submitText: 'Sign in',
      form: { botGuard: false },
      onSubmit: async (values) => {
        // Real app: fetch /api/session first, then
        //   const password = await sealSecret(values.password as Secret, session.encryption, 'password');
        //   await secureSubmit('/api/login', { ...values, password }, { csrfToken: session.csrfToken });
        void sealSecret; void secureSubmit;
        const pw = values.password as Secret;
        setLog((l) => [`submitted ${values.email} (password: ${pw.length} chars, never a string)`, ...l]);
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true, message: 'Signed in (demo).' };
      },
    }),
    [],
  );

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>PixiForm + React</h1>
      <p>
        Accent:{' '}
        {(['indigo', 'teal', 'rose', 'amber', 'violet', 'slate'] as Accent[]).map((a) => (
          <button key={a} onClick={() => setAccent(a)} aria-pressed={a === accent} style={{ marginRight: 6 }}>
            {a}
          </button>
        ))}
        <button onClick={() => handle.current?.reset()} style={{ marginLeft: 12 }}>
          Reset form
        </button>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24 }}>
        <PixiForm config={config} theme={accent} onReady={(h) => (handle.current = h)} />
        <section>
          <h2>Events</h2>
          <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </section>
      </div>
    </main>
  );
}
