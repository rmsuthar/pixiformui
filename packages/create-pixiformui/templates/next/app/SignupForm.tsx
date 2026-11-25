'use client';
import { useMemo, useState } from 'react';
import type { PixiFormConfig, PixiFormHandle } from 'pixiformui';
import { PixiForm } from './PixiForm';
import { formConfig } from '../src/form';

export function SignupForm() {
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
    <>
      {/* skeleton: the server sends labels and layout; the canvas form replaces them in the browser. */}
      <PixiForm config={config} onReady={onReady} skeleton />
      <p role="status" aria-live="polite">
        {status}
      </p>
    </>
  );
}
