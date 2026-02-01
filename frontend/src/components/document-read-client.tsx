'use client';

import { useState } from 'react';
import type { RenderedBlock } from '@flashread/dependencies/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlashReadMode } from '@/components/flashread-mode';
import Link from 'next/link';

interface DerivedFlashread {
  blocks: Array<{ type: 'heading' | 'p'; text: string }>;
  created_at: string;
  source_ocr_version: string;
}

interface DocumentReadClientProps {
  documentId: string;
  documentName: string;
  flashreadData: DerivedFlashread;
}

export function DocumentReadClient({
  documentId,
  documentName,
  flashreadData,
}: DocumentReadClientProps) {
  const [isReadingMode, setIsReadingMode] = useState(false);

  // Convert to RenderedBlock format
  const blocks: RenderedBlock[] = flashreadData.blocks;

  if (isReadingMode) {
    return (
      <FlashReadMode
        blocks={blocks}
        title={documentName}
        onExit={() => setIsReadingMode(false)}
        documentId={documentId}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Read Document</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Your document has been processed and is ready to read.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => setIsReadingMode(true)} className="gap-2">
            <PlayIcon className="w-4 h-4" />
            Start Reading
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/app/${documentId}`}>View Full Text</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
