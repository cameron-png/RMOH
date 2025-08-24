'use server';

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {firebase} from '@genkit-ai/firebase';

// The Firebase Admin app is now initialized in src/lib/firebase/server.ts
// Genkit will automatically use the initialized app instance.

export const ai = genkit({
  plugins: [
    googleAI(),
    firebase({
      flowStateStore: 'firebase',
      traceStore: 'firebase',
    }),
  ],
});
