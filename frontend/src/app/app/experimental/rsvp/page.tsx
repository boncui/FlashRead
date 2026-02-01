import { Suspense } from 'react';
import { getFlashreads } from '@flashread/backend/actions/flashreads';
import { RsvpExperimentalClient } from './client';

export const metadata = {
  title: 'Experimental RSVP Mode | FlashRead',
  description: 'Experimental Rapid Serial Visual Presentation reading mode',
};

export default async function RsvpExperimentalPage() {
  // Fetch user's flashreads to allow selecting one
  let flashreads: Awaited<ReturnType<typeof getFlashreads>> = [];
  try {
    flashreads = await getFlashreads();
  } catch {
    // User might not be authenticated, we'll handle in client
  }

  return (
    <Suspense fallback={<RsvpLoadingState />}>
      <RsvpExperimentalClient flashreads={flashreads} />
    </Suspense>
  );
}

function RsvpLoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-white/50">Loading...</div>
    </div>
  );
}
