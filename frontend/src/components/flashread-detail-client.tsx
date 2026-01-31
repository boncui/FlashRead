'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flashread } from '@flashread/backend/types';
import { updateFlashread, deleteFlashread } from '@flashread/backend/actions/flashreads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlashreadRenderer } from '@/components/flashread-renderer';

interface FlashreadDetailClientProps {
  flashread: Flashread;
}

export function FlashreadDetailClient({ flashread }: FlashreadDetailClientProps) {
  const router = useRouter();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(flashread.title);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTitleSave() {
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateFlashread(flashread.id, { title: title.trim() });
      setIsEditingTitle(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update title');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this FlashRead?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deleteFlashread(flashread.id);
      // Redirect is handled by the server action
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete FlashRead');
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.push('/app')}
          disabled={loading}
        >
          ← Back to List
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            {isEditingTitle ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                  className="max-w-md"
                />
                <Button
                  onClick={handleTitleSave}
                  disabled={loading}
                  size="sm"
                >
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setTitle(flashread.title);
                    setIsEditingTitle(false);
                    setError(null);
                  }}
                  variant="outline"
                  disabled={loading}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <>
                <CardTitle className="text-3xl">{flashread.title}</CardTitle>
                <Button
                  onClick={() => setIsEditingTitle(true)}
                  variant="outline"
                  disabled={loading}
                  size="sm"
                >
                  Edit Title
                </Button>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Created {new Date(flashread.created_at).toLocaleDateString()} •
            Updated {new Date(flashread.updated_at).toLocaleDateString()}
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md mb-4">
              {error}
            </div>
          )}
          <FlashreadRenderer blocks={flashread.rendered_blocks} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleDelete}
          variant="destructive"
          disabled={loading}
        >
          {loading ? 'Deleting...' : 'Delete FlashRead'}
        </Button>
      </div>
    </div>
  );
}
