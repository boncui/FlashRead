import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@flashread/backend/supabase/server';
import { getFlashreads } from '@flashread/backend/actions/flashreads';
import { getDocuments } from '@flashread/backend/actions/documents';
import { FlashreadCard } from '@/components/flashread-card';
import { DocumentCard } from '@/components/document-card';
import { Button } from '@/components/ui/button';

export default async function AppPage() {
  // Check auth before fetching data to prevent server-side exceptions
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  const [flashreads, documents] = await Promise.all([
    getFlashreads(),
    getDocuments(),
  ]);

  // Filter out documents stuck in "uploading" status for more than 5 minutes
  // These are likely failed uploads that should be cleaned up
  const STALE_UPLOAD_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
  const now = new Date().getTime();
  
  const activeDocuments = documents.filter((doc) => {
    if (doc.status === 'uploading') {
      const createdAt = new Date(doc.created_at).getTime();
      const isStale = now - createdAt > STALE_UPLOAD_THRESHOLD;
      return !isStale; // Exclude stale uploads
    }
    return true; // Include all other documents
  });

  const hasContent = flashreads.length > 0 || activeDocuments.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">Your Library</h1>
        <Link href="/app/new">
          <Button>New FlashRead</Button>
        </Link>
      </div>

      {!hasContent ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg mb-4">
            You haven&apos;t created any FlashReads or uploaded any documents yet.
          </p>
          <Link href="/app/new">
            <Button>Create Your First FlashRead</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Documents Section */}
          {activeDocuments.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold mb-4">Documents</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDocuments.map((document) => (
                  <DocumentCard key={document.id} document={document} />
                ))}
              </div>
            </section>
          )}

          {/* FlashReads Section */}
          {flashreads.length > 0 && (
            <section>
              <h2 className="text-2xl font-semibold mb-4">FlashReads</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {flashreads.map((flashread) => (
                  <FlashreadCard key={flashread.id} flashread={flashread} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
