import { RenderedBlock } from '@flashread/backend/types';

interface FlashreadRendererProps {
  blocks: RenderedBlock[];
}

export function FlashreadRenderer({ blocks }: FlashreadRendererProps) {
  return (
    <div className="prose prose-slate max-w-none">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <h2
              key={index}
              className="text-2xl font-bold mt-8 mb-4 first:mt-0 text-foreground"
            >
              {block.text}
            </h2>
          );
        }
        return (
          <p key={index} className="mb-4 leading-7 text-foreground">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
