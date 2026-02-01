'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { logOcrDemand } from '@flashread/backend/actions';

interface OcrDemandButtonProps {
  documentId: string;
  documentName: string;
}

/**
 * OCR button that tracks user demand.
 * - Click 1: Shows brief "processing" state
 * - Click 2+: Shows "Coming Soon" modal and logs demand to database
 */
export function OcrDemandButton({ documentId, documentName }: OcrDemandButtonProps) {
  const [clickCount, setClickCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const hasLoggedDemand = useRef(false);

  const handleClick = useCallback(async () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (newCount >= 2) {
      // Show modal and log demand (once per session)
      setShowModal(true);
      
      if (!hasLoggedDemand.current) {
        hasLoggedDemand.current = true;
        try {
          await logOcrDemand(documentId, newCount);
        } catch (error) {
          console.error('Failed to log OCR demand:', error);
        }
      }
    } else {
      // First click: show brief processing state
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
      }, 1500);
    }
  }, [clickCount, documentId]);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isProcessing}
        variant="outline"
        className="w-full"
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
            Processing OCR...
          </span>
        ) : (
          'Run OCR Extraction'
        )}
      </Button>

      {/* Coming Soon Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          
          {/* Modal */}
          <div className="relative bg-background border rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-4">
              {/* Icon */}
              <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-amber-600 dark:text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-xl font-semibold">OCR Coming Soon</h3>

              {/* Description */}
              <div className="text-muted-foreground space-y-2">
                <p>
                  OCR text extraction for scanned documents is not available yet.
                </p>
                <p className="text-sm">
                  We've noted your interest! This feature requires cloud infrastructure 
                  that we're still setting up.
                </p>
              </div>

              {/* Alternatives */}
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <h4 className="font-medium text-sm mb-2">In the meantime, you can:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">•</span>
                    <span>Upload PDFs with embedded text (most digital PDFs work)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">•</span>
                    <span>Upload TXT files directly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">•</span>
                    <span>Copy and paste text manually</span>
                  </li>
                </ul>
              </div>

              {/* Close button */}
              <Button onClick={closeModal} className="w-full">
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
