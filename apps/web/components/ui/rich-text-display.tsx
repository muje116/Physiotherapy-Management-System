'use client';

import { cn } from '@/lib/utils';
import { sanitizeRichText } from '@/components/ui/textarea';

export function RichTextDisplay({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return null;
  return <div className={cn('rich-text-display', className)} dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }} />;
}
