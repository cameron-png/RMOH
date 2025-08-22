
'use server';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {firebase} from '@genkit-ai/firebase';
import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize the Firebase Admin app only if it hasn't been initialized yet.
// This prevents re-initialization errors in hot-reload environments.
if (getApps().length === 0) {
  initializeApp();
}

export const ai = genkit({
  plugins: [googleAI(), firebase()],
  flowStateStore: 'firebase',
  traceStore: 'firebase',
});
