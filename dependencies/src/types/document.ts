export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'error';
export type DocumentFileType = 'pdf' | 'docx' | 'doc' | 'pptx' | 'ppt';

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
  extracted_text: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateDocumentInput {
  name: string;
  file_type: DocumentFileType;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
}

export interface UpdateDocumentInput {
  name?: string;
  status?: DocumentStatus;
  page_count?: number;
  extracted_text?: string;
  error_message?: string;
  metadata?: Record<string, any>;
}
