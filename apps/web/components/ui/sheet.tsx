'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface SheetContextValue {
  open: boolean;
  onClose: () => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheet() {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error('Sheet compound components must be used within Sheet');
  return ctx;
}

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({ open: controlledOpen, onOpenChange, children }: SheetProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const onClose = () => {
    if (!isControlled) setInternalOpen(false);
    onOpenChange?.(false);
  };

  return (
    <SheetContext.Provider value={{ open, onClose }}>
      {children}
    </SheetContext.Provider>
  );
}

function SheetTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const { onClose } = useSheet();
  const child = React.Children.only(children) as React.ReactElement;
  if (asChild) {
    return React.cloneElement(child, { onClick: onClose });
  }
  return <button onClick={onClose}>{children}</button>;
}

function SheetContent({
  children,
  side = 'right',
  className,
}: {
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
}) {
  const { open, onClose } = useSheet();

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          'fixed z-50 gap-4 bg-background p-6 shadow-lg transition-transform',
          side === 'left' ? 'inset-y-0 left-0 h-full w-3/4 max-w-sm' : 'inset-y-0 right-0 h-full w-3/4 max-w-sm',
          className
        )}
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </>
  );
}

function SheetHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)}>{children}</div>;
}

function SheetTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn('text-lg font-semibold text-foreground', className)}>{children}</h2>;
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle };
