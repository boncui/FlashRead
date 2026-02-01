'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  requestDocumentUpload, 
  checkDocumentByHash, 
  markDocumentUploaded,
  createFlashread
} from '@flashread/backend/actions';
import { formatTextToBlocks } from '@flashread/backend/lib/flashread-formatter';
import type { Document } from '@flashread/dependencies/types';

interface PdfUploadProps {
  onUploadComplete?: (document: Document) => void;
  onExistingDocument?: (document: Document) => void;
  onTxtComplete?: () => void;
}

type UploadState = 
  | { status: 'idle' }
  | { status: 'hashing'; progress: number }
  | { status: 'checking' }
  | { status: 'duplicate'; document: Document }
  | { status: 'uploading'; progress: number }
  | { status: 'complete'; document: Document }
  | { status: 'processing_txt'; fileName: string }
  | { status: 'error'; message: string };

/**
 * Compute SHA-256 hash of file bytes
 */
async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PdfUpload({ onUploadComplete, onExistingDocument, onTxtComplete }: PdfUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleTxtFile = useCallback(async (file: File) => {
    setSelectedFile(file);
    setState({ status: 'processing_txt', fileName: file.name });

    try {
      // Read the file content
      const text = await file.text();
      
      if (!text.trim()) {
        setState({ status: 'error', message: 'The file appears to be empty' });
        return;
      }

      // Create FlashRead directly from the text (same as manual paste)
      const blocks = formatTextToBlocks(text);
      const title = file.name.replace(/\.txt$/i, '') || 'Untitled';
      
      await createFlashread({
        title,
        source_text: text,
        rendered_blocks: blocks,
      });
      
      // The createFlashread action redirects, but we also call the callback
      onTxtComplete?.();
    } catch (error) {
      console.error('TXT processing error:', error);
      setState({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Failed to process TXT file' 
      });
    }
  }, [onTxtComplete]);

  const handlePdfFile = useCallback(async (file: File) => {
    setSelectedFile(file);

    try {
      // Step 1: Compute hash
      setState({ status: 'hashing', progress: 0 });
      const contentHash = await computeFileHash(file);
      setState({ status: 'hashing', progress: 100 });

      // Step 2: Check for duplicates
      setState({ status: 'checking' });
      const existingDoc = await checkDocumentByHash(contentHash);
      
      if (existingDoc) {
        setState({ status: 'duplicate', document: existingDoc });
        onExistingDocument?.(existingDoc);
        return;
      }

      // Step 3: Request upload URL
      setState({ status: 'uploading', progress: 0 });
      const { uploadUrl, document } = await requestDocumentUpload(
        file.name,
        'pdf',
        file.type,
        file.size,
        contentHash
      );

      // Step 4: Upload to R2
      let response: Response;
      try {
        response = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });
      } catch (fetchError) {
        // Network or CORS error
        console.error('R2 upload fetch error:', fetchError);
        throw new Error(
          'Failed to upload to storage. This may be a CORS configuration issue. ' +
          'Please check that your R2 bucket has CORS enabled for your domain.'
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('R2 upload failed:', response.status, errorText);
        throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
      }

      // Step 5: Mark as uploaded
      try {
        await markDocumentUploaded(document.id);
      } catch (markError) {
        console.error('Failed to mark document as uploaded:', markError);
        throw new Error(
          'File uploaded but failed to update status. Please refresh the page.'
        );
      }
      
      setState({ status: 'complete', document: { ...document, status: 'uploaded' } });
      onUploadComplete?.({ ...document, status: 'uploaded' });

    } catch (error) {
      console.error('Upload error:', error);
      setState({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Upload failed' 
      });
    }
  }, [onUploadComplete, onExistingDocument]);

  const handleFile = useCallback(async (file: File) => {
    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setState({ status: 'error', message: 'File size must be less than 50MB' });
      return;
    }

    // Handle TXT files - create FlashRead directly
    if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
      await handleTxtFile(file);
      return;
    }

    // Handle PDF files - upload and process
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      await handlePdfFile(file);
      return;
    }

    // Unsupported file type
    setState({ status: 'error', message: 'Please select a PDF or TXT file' });
  }, [handleTxtFile, handlePdfFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleReset = useCallback(() => {
    setState({ status: 'idle' });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleViewExisting = useCallback(() => {
    if (state.status === 'duplicate') {
      router.push(`/app/documents/${state.document.id}`);
    }
  }, [state, router]);

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf,text/plain,.txt"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Idle / Drop zone state */}
      {state.status === 'idle' && (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            }
          `}
        >
          <div className="flex flex-col items-center gap-3">
            <svg
              className="w-12 h-12 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <div>
              <p className="font-medium">Drop your file here</p>
              <p className="text-sm text-muted-foreground mt-1">
                PDF or TXT (max 50MB)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing TXT state */}
      {state.status === 'processing_txt' && (
        <div className="border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
            <div className="flex-1">
              <p className="font-medium">Processing text file...</p>
              <p className="text-sm text-muted-foreground">
                {state.fileName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hashing state */}
      {state.status === 'hashing' && (
        <div className="border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
            <div className="flex-1">
              <p className="font-medium">Computing file hash...</p>
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checking duplicates state */}
      {state.status === 'checking' && (
        <div className="border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
            <div className="flex-1">
              <p className="font-medium">Checking for duplicates...</p>
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  {selectedFile.name}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate found state */}
      {state.status === 'duplicate' && (
        <div className="border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 rounded-lg p-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Document already exists
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                This PDF has already been uploaded as "{state.document.name}"
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleViewExisting}>
                View existing
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Upload different file
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Uploading state */}
      {state.status === 'uploading' && (
        <div className="border rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
            <div className="flex-1">
              <p className="font-medium">Uploading...</p>
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Complete state */}
      {state.status === 'complete' && (
        <div className="border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 rounded-lg p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Upload complete
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {state.document.name} - Waiting for OCR processing
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => router.push(`/app/documents/${state.document.id}`)}
              >
                View document
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Upload another
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {state.status === 'error' && (
        <div className="border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 rounded-lg p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  Upload failed
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {state.message}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>
              Try again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
