import { mountPixiForm } from 'pixiformui';
import { formConfig } from './form';
import './style.css';

const handle = await mountPixiForm(document.getElementById('form')!, {
  ...formConfig,
  on: {
    success: (e) => console.log('Submitted:', e.result.message),
    fieldvisibility: (e) => console.log(`${e.name} is now ${e.visible ? 'shown' : 'hidden'}`),
  },
});

// Values you know from the page can go into hidden fields, e.g. a campaign from the URL:
const campaign = new URLSearchParams(location.search).get('utm_campaign');
if (campaign) handle.get('source')?.setValue(campaign.slice(0, 64));
