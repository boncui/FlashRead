export type RenderedBlock = {
  type: 'heading' | 'p';
  text: string;
};

export interface Flashread {
  id: string;
  user_id: string;
  title: string;
  source_text: string;
  render_config: Record<string, any>;
  rendered_blocks: RenderedBlock[];
  created_at: string;
  updated_at: string;
}

export interface CreateFlashreadInput {
  title?: string;
  source_text: string;
  render_config?: Record<string, any>;
  rendered_blocks: RenderedBlock[];
}

export interface UpdateFlashreadInput {
  title?: string;
  source_text?: string;
  render_config?: Record<string, any>;
  rendered_blocks?: RenderedBlock[];
}
