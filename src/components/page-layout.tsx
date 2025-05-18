import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  headerActions?: ReactNode;
}

export function PageLayout({
  children,
  title,
  description,
  className,
  headerActions,
}: PageLayoutProps) {
  return (
    <div className={cn("w-full max-w-6xl mx-auto py-6 px-4 space-y-6", className)}>
      {(title || description || headerActions) && (
        <div className="flex justify-between items-center mb-6">
          <div className="space-y-1">
            {title && (
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
} 