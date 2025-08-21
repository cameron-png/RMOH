
// This is a script to seed your Firestore database with the initial form templates.
// To run this script, you'll need to install ts-node: `npm install -g ts-node`
// Then, you can run it from your project root: `ts-node --esm src/lib/seed-form-templates.ts`
// Make sure your Firebase credentials are set up in your environment.

import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase'; // Adjust the import path as necessary
import { v4 as uuidv4 } from 'uuid';
import { FeedbackForm, Question } from './types';

const templateForms: Omit<FeedbackForm, 'id'>[] = [
  {
    title: 'General Property Feedback',
    description: 'A standard form to collect general impressions of the property from visitors.',
    type: 'global',
    questions: [
      { id: uuidv4(), text: 'What is your overall impression of this property?', type: 'rating' },
      { id: uuidv4(), text: 'Did you like the layout of the home?', type: 'yes-no' },
      { id: uuidv4(), text: 'Which room was your favorite and why?', type: 'short-answer' },
      { id: uuidv4(), text: 'How would you rate the neighborhood?', type: 'rating' },
      { id: uuidv4(), text: 'Are you currently working with a real estate agent?', type: 'yes-no' },
    ],
  },
  {
    title: 'First-Time Homebuyer Feedback',
    description: 'A form tailored to the needs and concerns of first-time homebuyers.',
    type: 'global',
    questions: [
      { id: uuidv4(), text: 'Does this home meet your current needs?', type: 'yes-no' },
      { id: uuidv4(), text: 'What do you think of the price?', type: 'multiple-choice', options: [ {id: uuidv4(), value: 'Too high'}, {id: uuidv4(), value: 'About right'}, {id: uuidv4(), value: 'A great deal'}] },
      { id: uuidv4(), text: 'How important is the school district to you?', type: 'rating' },
      { id: uuidv4(), text: 'Is there anything about this home that confuses you as a first-time buyer?', type: 'short-answer' },
    ],
  },
  {
    title: 'Investor Feedback',
    description: 'Questions designed for real estate investors looking for rental or flip opportunities.',
    type: 'global',
    questions: [
      { id: uuidv4(), text: 'What is your estimated "After Repair Value" (ARV) for this property?', type: 'short-answer' },
      { id: uuidv4(), text: 'How would you rate the investment potential?', type: 'rating' },
      { id: uuidv4(), text: 'Did you identify any major repairs needed?', type: 'yes-no' },
      { id: uuidv4(), text: 'What is your estimated monthly rent for this property?', type: 'short-answer' },
    ],
  },
  {
    title: 'Luxury Property Feedback',
    description: 'Feedback for high-end properties with discerning buyers.',
    type: 'global',
    questions: [
      { id: uuidv4(), text: 'Do the finishes and materials meet your expectations for a luxury property?', type: 'yes-no' },
      { id: uuidv4(), text: 'How would you rate the unique architectural features of this home?', type: 'rating' },
      { id: uuidv4(), text: 'What is your opinion on the amenities offered (e.g., pool, home theater)?', type: 'short-answer' },
      { id: uuidv4(), text: 'Does the property offer the level of privacy you expect?', type: 'yes-no' },
    ],
  },
];

async function seedForms() {
  const formsCollection = collection(db, 'feedbackForms');

  console.log('Checking for existing form templates and adding new ones...');

  for (const form of templateForms) {
    // Check if a form with the same title already exists
    const q = query(formsCollection, where('type', '==', 'global'), where('title', '==', form.title));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // Form doesn't exist, so add it
      try {
        const docRef = await addDoc(formsCollection, {
          ...form,
          createdAt: new Date(),
        });
        console.log(`Successfully added form: "${form.title}" with ID: ${docRef.id}`);
      } catch (e) {
        console.error(`Error adding document: ${form.title}`, e);
      }
    } else {
      console.log(`Form "${form.title}" already exists. Skipping.`);
    }
  }
  console.log('Seeding process complete!');
}


seedForms().then(() => {
    // Manually exit the process if it hangs.
    process.exit(0);
}).catch((error) => {
    console.error("Seeding failed with an unhandled error:", error);
    process.exit(1);
});
