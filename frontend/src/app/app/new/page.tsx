'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createFlashread } from '@flashread/backend/actions/flashreads';
import { formatTextToBlocks } from '@flashread/backend/lib/flashread-formatter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlashreadRenderer } from '@/components/flashread-renderer';
import { PdfUpload } from '@/components/pdf-upload';
import { RenderedBlock } from '@flashread/dependencies/types';

type InputMode = 'text' | 'pdf';

export default function NewFlashreadPage() {
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>('text');
  const [title, setTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [preview, setPreview] = useState<RenderedBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePreview() {
    if (!sourceText.trim()) {
      setError('Please enter some text');
      return;
    }
    setError(null);
    const blocks = formatTextToBlocks(sourceText);
    setPreview(blocks);
  }

  async function handleSave() {
    if (!sourceText.trim()) {
      setError('Please enter some text');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const blocks = formatTextToBlocks(sourceText);
      await createFlashread({
        title: title.trim() || 'Untitled',
        source_text: sourceText,
        rendered_blocks: blocks,
      });
      // Redirect is handled by the server action
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create FlashRead');
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Create New FlashRead</h1>

      <div className="space-y-6">
        {/* Mode Toggle */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            onClick={() => setMode('text')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'text'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Paste Text
          </button>
          <button
            onClick={() => setMode('pdf')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'pdf'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Upload File
          </button>
        </div>

        {/* Text Input Mode */}
        {mode === 'text' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Input</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title (optional)</Label>
                  <Input
                    id="title"
                    placeholder="Enter a title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source">Source Text</Label>
                  <Textarea
                    id="source"
                    placeholder="Paste your text here..."
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    className="min-h-[300px]"
                    disabled={loading}
                  />
                </div>
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {error}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={handlePreview} variant="outline" disabled={loading}>
                    Preview
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? 'Saving...' : 'Save FlashRead'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {preview.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <FlashreadRenderer blocks={preview} />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* File Upload Mode */}
        {mode === 'pdf' && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong>TXT files:</strong> Instantly converted to FlashRead format.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>PDF files:</strong> Text will be extracted automatically. 
                Scanned PDFs may require OCR processing.
              </p>
              <PdfUpload
                onUploadComplete={(doc) => {
                  router.push(`/app/documents/${doc.id}`);
                }}
                onExistingDocument={(doc) => {
                  // User can choose to view existing from the component UI
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
