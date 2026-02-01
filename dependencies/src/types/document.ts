// Document status lifecycle:
// uploading -> uploaded -> pending_ocr -> processing -> ready
//                                      \-> error
//                       \-> processing -> ocr_failed
export type DocumentStatus = 'uploading' | 'uploaded' | 'pending_ocr' | 'processing' | 'ready' | 'ocr_failed' | 'error';
export type DocumentFileType = 'pdf' | 'docx' | 'doc' | 'pptx' | 'ppt';

// ============================================================
// OCR Version Types - Structured text extraction from documents
// ============================================================

export type PageBlockType = 
  | 'title'
  | 'section_header'
  | 'header'  // Alias for section_header
  | 'paragraph'
  | 'equation'
  | 'table'
  | 'figure'
  | 'caption'
  | 'list'
  | 'code'
  | 'citation'
  | 'footnote'
  | 'other'
  | 'unknown';

export interface PageBlock {
  type: PageBlockType;
  text: string;
  /** LaTeX content for equations */
  latex?: string;
  /** Table cells for table blocks */
  cells?: string[][];
  /** Confidence score from OCR (0-1) */
  confidence?: number;
  /** Bounding box [x, y, width, height] in page coordinates */
  bbox?: [number, number, number, number];
}

export interface OcrPage {
  page: number;
  blocks: PageBlock[];
  /** Raw text for this page (fallback) */
  raw_text?: string;
  /** Full page text */
  text?: string;
  /** Confidence score (0-1, only for OCR methods) */
  confidence?: number;
}

export interface OcrMetrics {
  total_pages: number;
  method: 'direct' | 'paddle' | 'tesseract' | 'hybrid';
  char_count: number;
  avg_conf?: number;  // Only for OCR methods
  runtime_ms: number;
  // Phase 2b OCR-specific fields
  dpi_initial?: number;
  dpi_rerun?: number;
  bad_pages?: number[];  // Pages that needed rerun or fallback
  fallback_pages?: number[];  // Pages that used Tesseract
}

export interface OcrVersion {
  created_at: string;
  engine: string;           // 'pymupdf' | 'paddleocr' | 'tesseract'
  engine_version: string;   // e.g., '1.23.8'
  pipeline_version: string; // e.g., '1.0.0'
  pages: OcrPage[];
  doc_text?: string;        // Full text with page separators
  metrics: OcrMetrics;
  warnings?: string[];

  // Keep legacy fields for backward compat (optional)
  model_name?: string;      // Alias for engine
  model_version?: string;   // Alias for engine_version
  /** @deprecated Use metrics.runtime_ms instead */
  processing_time_ms?: number;
}

/** Map of OCR version keys to their data */
export type OcrVersions = Record<string, OcrVersion>;

// ============================================================
// Derived Content Types - Processed representations of document
// ============================================================

export interface DerivedMarkdown {
  content: string;
  created_at: string;
  source_ocr_version: string;
}

export interface DerivedFlashread {
  blocks: Array<{ type: 'heading' | 'p'; text: string }>;
  created_at: string;
  source_ocr_version: string;
}

export interface DerivedSummary {
  content: string;
  created_at: string;
  model?: string;
  source_ocr_version: string;
}

export interface DerivedContent {
  markdown_v1?: DerivedMarkdown;
  flashread_v1?: DerivedFlashread;
  summary_v1?: DerivedSummary;
  [key: string]: DerivedMarkdown | DerivedFlashread | DerivedSummary | undefined;
}

// ============================================================
// Document Entity
// ============================================================

export interface Document {
  id: string;
  user_id: string;
  name: string;
  file_type: DocumentFileType;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  status: DocumentStatus;
  page_count: number | null;
  /** @deprecated Use ocr_versions instead */
  extracted_text: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  /** SHA-256 hash of file bytes for deduplication */
  content_hash: string | null;
  /** Versioned OCR outputs */
  ocr_versions: OcrVersions;
  /** Derived content representations */
  derived_content: DerivedContent;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ============================================================
// Input Types for CRUD Operations
// ============================================================

export interface CreateDocumentInput {
  name: string;
  file_type: DocumentFileType;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  content_hash?: string;
}

export interface UpdateDocumentInput {
  name?: string;
  status?: DocumentStatus;
  page_count?: number;
  /** @deprecated Use updateOcrVersion instead */
  extracted_text?: string;
  error_message?: string;
  metadata?: Record<string, any>;
  ocr_versions?: OcrVersions;
  derived_content?: DerivedContent;
}
