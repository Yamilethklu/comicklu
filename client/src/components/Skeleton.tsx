import type { ReactNode } from "react";

export function Skeleton({ className = "", children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={`animate-pulse rounded-lg border-2 border-ink bg-white ${className}`}>
      {children}
    </div>
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-white animate-pulse" style={{ width: i === lines - 1 ? "60%" : "100%" }} />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ className = "" }: { className?: string }) {
  return <div className={`h-12 w-12 rounded-full bg-white animate-pulse ${className}`} />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`frame p-4 shadow-hard ${className}`}>
      <div className="h-32 w-full rounded-xl bg-white animate-pulse" />
      <div className="mt-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-white animate-pulse" />
        <div className="h-4 w-full rounded bg-white animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-white animate-pulse" />
      </div>
    </div>
  );
}