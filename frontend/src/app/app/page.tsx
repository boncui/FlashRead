import Link from 'next/link';
import { getFlashreads } from '@flashread/backend/actions/flashreads';
import { FlashreadCard } from '@/components/flashread-card';
import { Button } from '@/components/ui/button';

export default async function AppPage() {
  const flashreads = await getFlashreads();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">Your FlashReads</h1>
        <Link href="/app/new">
          <Button>New FlashRead</Button>
        </Link>
      </div>

      {flashreads.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg mb-4">
            You haven&apos;t created any FlashReads yet.
          </p>
          <Link href="/app/new">
            <Button>Create Your First FlashRead</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flashreads.map((flashread) => (
            <FlashreadCard key={flashread.id} flashread={flashread} />
          ))}
        </div>
      )}
    </div>
  );
}
