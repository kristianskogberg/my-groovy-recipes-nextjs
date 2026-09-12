import * as React from "react";

import { cn } from "@/lib/utils";

export function Tag({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-input bg-background py-0.5 pl-2.5 pr-2.5 text-sm text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function TagList({
  className,
  tags,
}: {
  className?: string;
  tags: string[];
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {tags.map((tag) => (
        <Tag key={tag}>{tag}</Tag>
      ))}
    </div>
  );
}
