'use client';

import * as React from 'react';
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react';
import { cn } from '@/lib/utils';

type EditorProps = Pick<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'placeholder' | 'disabled' | 'required' | 'rows' | 'id' | 'name' | 'maxLength'> & {
  value?: string;
  defaultValue?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
};

const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE']);

function escapeText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function sanitizeRichText(value: string) {
  if (typeof window === 'undefined') {
    if (!/<\/?[a-z][^>]*>/i.test(value)) return escapeText(value).replace(/\n/g, '<br>');
    return value.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, rawTag: string) => {
      const tag = rawTag.toUpperCase();
      if (!ALLOWED_TAGS.has(tag)) return '';
      const outputTag = tag === 'B' ? 'strong' : tag === 'I' ? 'em' : tag.toLowerCase();
      if (tag === 'BR') return '<br>';
      return match.startsWith('</') ? `</${outputTag}>` : `<${outputTag}>`;
    });
  }
  if (!/<\/?[a-z][^>]*>/i.test(value)) return escapeText(value).replace(/\n/g, '<br>');

  const parsed = new DOMParser().parseFromString(value, 'text/html');
  const serialize = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent || '');
    if (!(node instanceof Element)) return '';
    const contents = Array.from(node.childNodes, serialize).join('');
    const tag = node.tagName.toUpperCase();
    if (tag === 'DIV') return `<p>${contents}</p>`;
    if (!ALLOWED_TAGS.has(tag)) return contents;
    const outputTag = tag === 'B' ? 'strong' : tag === 'I' ? 'em' : tag.toLowerCase();
    return tag === 'BR' ? '<br>' : `<${outputTag}>${contents}</${outputTag}>`;
  };
  return Array.from(parsed.body.childNodes, serialize).join('');
}

const RichTextEditor = React.forwardRef<HTMLDivElement, EditorProps>(
  ({ className, value, defaultValue, onChange, placeholder, disabled, required, rows = 4, id, name, maxLength, 'aria-label': ariaLabel, 'aria-invalid': ariaInvalid }, forwardedRef) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const lastEmitted = React.useRef<string | null>(null);
    React.useImperativeHandle(forwardedRef, () => editorRef.current as HTMLDivElement);
    const content = value ?? defaultValue ?? '';

    React.useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      if (lastEmitted.current === content) {
        lastEmitted.current = null;
        return;
      }
      const nextHtml = sanitizeRichText(content);
      if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml;
    }, [content]);

    const emitChange = () => {
      const editor = editorRef.current;
      if (editor && maxLength && (editor.innerText || '').length > maxLength) {
        editor.textContent = (editor.innerText || '').slice(0, maxLength);
      }
      const html = sanitizeRichText(editor?.innerHTML || '');
      lastEmitted.current = html;
      onChange?.({ target: { value: html } } as React.ChangeEvent<HTMLTextAreaElement>);
    };

    const applyCommand = (command: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false);
      emitChange();
    };

    const pastePlainText = (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
      emitChange();
    };

    return (
      <div className={cn('overflow-hidden rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring', disabled && 'opacity-60', ariaInvalid && 'border-destructive', className)}>
        <div className="flex items-center gap-1 border-b bg-muted/40 px-2 py-1" role="toolbar" aria-label="Text formatting">
          <FormatButton label="Bold" onClick={() => applyCommand('bold')}><Bold className="h-4 w-4" /></FormatButton>
          <FormatButton label="Italic" onClick={() => applyCommand('italic')}><Italic className="h-4 w-4" /></FormatButton>
          <FormatButton label="Underline" onClick={() => applyCommand('underline')}><Underline className="h-4 w-4" /></FormatButton>
          <span className="mx-1 h-5 border-l" />
          <FormatButton label="Bulleted list" onClick={() => applyCommand('insertUnorderedList')}><List className="h-4 w-4" /></FormatButton>
          <FormatButton label="Numbered list" onClick={() => applyCommand('insertOrderedList')}><ListOrdered className="h-4 w-4" /></FormatButton>
        </div>
        <div
          ref={editorRef}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel || placeholder || 'Rich text editor'}
          aria-invalid={ariaInvalid}
          aria-required={required || undefined}
          contentEditable={!disabled}
          suppressContentEditableWarning
          data-placeholder={placeholder || 'Enter text…'}
          data-name={name}
          className="rich-text-editor w-full overflow-y-auto px-3 py-2 text-sm outline-none"
          style={{ minHeight: `${Math.max(2, Number(rows)) * 1.5}rem` }}
          onInput={emitChange}
          onPaste={pastePlainText}
        />
      </div>
    );
  }
);
RichTextEditor.displayName = 'RichTextEditor';

function FormatButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick} title={label} aria-label={label} className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground">{children}</button>;
}

const Textarea = RichTextEditor;

export { RichTextEditor, Textarea };
