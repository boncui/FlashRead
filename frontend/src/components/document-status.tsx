'use client';

import type { DocumentStatus } from '@flashread/dependencies/types';

interface DocumentStatusProps {
  status: DocumentStatus;
  errorMessage?: string | null;
  className?: string;
}

const STATUS_CONFIG: Record<DocumentStatus, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  icon: 'spinner' | 'upload' | 'clock' | 'processing' | 'check' | 'error';
}> = {
  uploading: {
    label: 'Uploading',
    description: 'File is being uploaded...',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900',
    icon: 'spinner',
  },
  uploaded: {
    label: 'Uploaded',
    description: 'File uploaded successfully. Waiting for text extraction.',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
    icon: 'clock',
  },
  pending_ocr: {
    label: 'Needs OCR',
    description: 'Document needs OCR processing (no text layer detected).',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
    icon: 'clock',
  },
  processing: {
    label: 'Processing',
    description: 'Extracting text from your document...',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900',
    icon: 'processing',
  },
  ready: {
    label: 'Ready',
    description: 'Document is ready to read.',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900',
    icon: 'check',
  },
  ocr_failed: {
    label: 'OCR Failed',
    description: 'OCR could not extract sufficient text from this document.',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
    icon: 'error',
  },
  error: {
    label: 'Error',
    description: 'Something went wrong during processing.',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
    icon: 'error',
  },
};

function StatusIcon({ icon, className }: { icon: string; className?: string }) {
  switch (icon) {
    case 'spinner':
      return (
        <div className={`animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full ${className}`} />
      );
    case 'upload':
      return (
        <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      );
    case 'clock':
      return (
        <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'processing':
      return (
        <div className={`animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full ${className}`} />
      );
    case 'check':
      return (
        <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'error':
      return (
        <svg className={`w-5 h-5 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Badge showing document processing status
 */
export function DocumentStatusBadge({ status, className = '' }: DocumentStatusProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${className}`}>
      <StatusIcon icon={config.icon} className="w-3 h-3" />
      {config.label}
    </span>
  );
}

/**
 * Card showing document processing status with description
 */
export function DocumentStatusCard({ status, errorMessage, className = '' }: DocumentStatusProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <div className={`border rounded-lg p-4 ${config.bgColor} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={config.color}>
          <StatusIcon icon={config.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${config.color}`}>
            {config.label}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {errorMessage || config.description}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline status indicator (minimal)
 */
export function DocumentStatusIndicator({ status, className = '' }: DocumentStatusProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={config.color}>
        <StatusIcon icon={config.icon} className="w-4 h-4" />
      </div>
      <span className={`text-sm ${config.color}`}>{config.label}</span>
    </div>
  );
}
