'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { deleteStuckUpload } from '@flashread/backend/actions';

interface RetryUploadButtonProps {
  documentId: string;
  documentName: string;
}

export function RetryUploadButton({ documentId, documentName }: RetryUploadButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleRetry() {
    if (!confirm(`Delete the stuck upload for "${documentName}" and try again?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteStuckUpload(documentId);
      // Redirect to upload page
      router.push('/app/new?mode=pdf');
    } catch (error) {
      console.error('Failed to delete stuck upload:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete stuck upload');
      setIsDeleting(false);
    }
  }

  return (
    <Button 
      onClick={handleRetry} 
      variant="destructive"
      disabled={isDeleting}
    >
      {isDeleting ? 'Deleting...' : 'Delete & Retry Upload'}
    </Button>
  );
}
