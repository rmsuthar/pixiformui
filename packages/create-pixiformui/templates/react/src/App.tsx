import { useMemo, useState } from 'react';
import type { PixiFormConfig, PixiFormHandle } from 'pixiformui';
import { PixiForm } from './PixiForm';
import { formConfig } from './form';

export function App() {
  const [status, setStatus] = useState('');
  // Memoise the config: a new object rebuilds the form.
  const config = useMemo<PixiFormConfig>(
    () => ({
      ...formConfig,
      on: {
        success: (e) => setStatus(e.result.message ?? 'Submitted.'),
        failure: () => setStatus(''),
      },
    }),
    [],
  );

  const onReady = (handle: PixiFormHandle) => {
    // Values you know from the page can go into hidden fields, e.g. a campaign from the URL.
    const campaign = new URLSearchParams(location.search).get('utm_campaign');
    if (campaign) handle.get('source')?.setValue(campaign.slice(0, 64));
  };

  return (
    <main>
      <header>
        <h1>{'{{name}}'}</h1>
        <p>A secure sign-up form built with PixiFormUI and React.</p>
      </header>
      <PixiForm config={config} onReady={onReady} />
      <p role="status" aria-live="polite">{status}</p>
      <footer>
        Edit <code>src/form.ts</code> and <code>shared/fields.js</code>. <a href="https://pixiformui.lets.gen.in/docs/">PixiFormUI docs</a>
      </footer>
    </main>
  );
}
