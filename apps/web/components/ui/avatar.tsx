'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarContextValue {
  size: 'sm' | 'md' | 'lg';
}

const AvatarContext = React.createContext<AvatarContextValue>({ size: 'md' });

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function Avatar({ src, alt, fallback, size = 'md', className }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  return (
    <AvatarContext.Provider value={{ size }}>
      <div className={cn('relative inline-flex items-center justify-center rounded-full bg-muted overflow-hidden', sizeClasses[size], className)}>
        {src && !imgError ? (
          <img src={src} alt={alt || ''} className="h-full w-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <span className="font-medium text-muted-foreground">{fallback || alt?.charAt(0) || '?'}</span>
        )}
      </div>
    </AvatarContext.Provider>
  );
}

function AvatarImage({ src, alt }: { src: string; alt?: string }) {
  return <img src={src} alt={alt || ''} className="h-full w-full object-cover" />;
}

function AvatarFallback({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('font-medium text-muted-foreground', className)}>{children}</span>;
}

export { Avatar, AvatarImage, AvatarFallback };
