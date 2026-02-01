import { notFound } from 'next/navigation';
import { getDocument, getDocumentDownloadUrl } from '@flashread/backend/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DocumentStatusCard } from '@/components/document-status';
import { RetryUploadButton } from '@/components/retry-upload-button';
import { DeleteDocumentButton } from '@/components/delete-document-button';
import Link from 'next/link';

interface DocumentPageProps {
  params: Promise<{ id: string }>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params;
  const document = await getDocument(id);

  if (!document) {
    notFound();
  }

  // Get download URL for the PDF
  let downloadUrl: string | null = null;
  try {
    downloadUrl = await getDocumentDownloadUrl(id);
  } catch (e) {
    // Download URL may fail if file isn't uploaded yet
    console.error('Failed to get download URL:', e);
  }

  const isReady = document.status === 'ready';
  const hasError = document.status === 'error';
  const ocrFailed = document.status === 'ocr_failed';
  const isStuckUploading = document.status === 'uploading';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link 
          href="/app" 
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to library
        </Link>
      </div>

      <div className="space-y-6">
        {/* Document Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold truncate">{document.name}</h1>
            <p className="text-muted-foreground mt-1">
              Uploaded {formatDate(document.created_at)}
            </p>
          </div>
          <div className="flex gap-2">
            {downloadUrl && (
              <Button asChild variant="outline">
                <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                  Download PDF
                </a>
              </Button>
            )}
            <DeleteDocumentButton documentId={document.id} documentName={document.name} />
          </div>
        </div>

        {/* Status Card */}
        <DocumentStatusCard 
          status={document.status} 
          errorMessage={document.error_message}
        />

        {/* Stuck Upload Warning */}
        {isStuckUploading && (
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="text-amber-600 dark:text-amber-400">Upload Failed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                This document appears to be stuck in the uploading state. The upload may have failed 
                due to a network issue or CORS configuration problem.
              </p>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">What you can do:</h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>Delete this stuck upload and try uploading again</li>
                  <li>Check your network connection</li>
                  <li>Ensure your browser allows uploads to the storage service</li>
                </ol>
              </div>
              <RetryUploadButton documentId={document.id} documentName={document.name} />
            </CardContent>
          </Card>
        )}

        {/* Document Info */}
        <Card>
          <CardHeader>
            <CardTitle>Document Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">File Type</dt>
                <dd className="font-medium uppercase">{document.file_type}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">File Size</dt>
                <dd className="font-medium">{formatFileSize(document.size_bytes)}</dd>
              </div>
              {document.page_count && (
                <div>
                  <dt className="text-muted-foreground">Pages</dt>
                  <dd className="font-medium">{document.page_count}</dd>
                </div>
              )}
              {document.content_hash && (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Content Hash</dt>
                  <dd className="font-mono text-xs break-all">{document.content_hash}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Processing Status Info - only show for uploaded/processing states, not uploading */}
        {['uploaded', 'pending_ocr', 'processing'].includes(document.status) && (
          <Card>
            <CardHeader>
              <CardTitle>Processing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your document has been uploaded and is being processed for text extraction.
                This typically takes a few seconds.
              </p>
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">What happens next?</h4>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>Direct text extraction attempts to read embedded text</li>
                  <li>Text is structured into pages and blocks</li>
                  <li>FlashRead format is generated for easy reading</li>
                  <li>You'll be able to read it in the app</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending OCR State */}
        {document.status === 'pending_ocr' && (
          <Card className="border-amber-200 dark:border-amber-900">
            <CardHeader>
              <CardTitle className="text-amber-600 dark:text-amber-400">OCR Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                This document requires OCR processing. Text extraction found no usable text layer.
                This means the PDF is likely scanned or image-based. OCR processing is automatically queued.
              </p>
            </CardContent>
          </Card>
        )}

        {/* OCR Failed State */}
        {ocrFailed && (
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">OCR Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                OCR processing could not extract sufficient text from this document.
                The document may be damaged, very low quality, or in an unsupported format.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Ready State - Show FlashRead Link */}
        {isReady && document.derived_content?.flashread_v1 && (
          <Card>
            <CardHeader>
              <CardTitle>Read Document</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Your document has been processed and is ready to read.
              </p>
              <Button asChild>
                <Link href={`/app/${id}`}>Read as FlashRead</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* OCR Versions Info (for debugging/transparency) */}
        {document.ocr_versions && Object.keys(document.ocr_versions).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Extraction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(document.ocr_versions).map(([key, version]) => (
                  <div key={key} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium text-sm">{version.engine || version.model_name}</span>
                        <span className="text-muted-foreground text-sm ml-2">
                          v{version.engine_version || version.model_version}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(version.created_at).toLocaleString()}
                      </span>
                    </div>
                    {version.metrics && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Method:</span>
                          <span className="ml-1 font-medium">{version.metrics.method}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pages:</span>
                          <span className="ml-1 font-medium">{version.metrics.total_pages}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Characters:</span>
                          <span className="ml-1 font-medium">{version.metrics.char_count.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time:</span>
                          <span className="ml-1 font-medium">{version.metrics.runtime_ms}ms</span>
                        </div>
                        {version.metrics.avg_conf && (
                          <div>
                            <span className="text-muted-foreground">Confidence:</span>
                            <span className="ml-1 font-medium">{(version.metrics.avg_conf * 100).toFixed(1)}%</span>
                          </div>
                        )}
                        {version.metrics.dpi_initial && (
                          <div>
                            <span className="text-muted-foreground">DPI:</span>
                            <span className="ml-1 font-medium">
                              {version.metrics.dpi_initial}
                              {version.metrics.dpi_rerun && ` → ${version.metrics.dpi_rerun}`}
                            </span>
                          </div>
                        )}
                        {version.metrics.bad_pages && version.metrics.bad_pages.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Bad pages:</span>
                            <span className="ml-1 font-medium">{version.metrics.bad_pages.length}</span>
                          </div>
                        )}
                        {version.metrics.fallback_pages && version.metrics.fallback_pages.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Tesseract fallback pages:</span>
                            <span className="ml-1 font-medium">{version.metrics.fallback_pages.length}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {version.warnings && version.warnings.length > 0 && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        ⚠ {version.warnings.join(' ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {hasError && (
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">Processing Failed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                There was an error processing your document. 
                {document.error_message && (
                  <span className="block mt-2 text-sm text-red-600 dark:text-red-400">
                    {document.error_message}
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                You can try uploading the document again or contact support if the issue persists.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
