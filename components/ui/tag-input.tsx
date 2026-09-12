"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

export function TagInput({
  className,
  defaultValue = [],
  label,
  name,
  placeholder,
  removeLabel,
}: {
  className?: string;
  defaultValue?: string[];
  label: string;
  name: string;
  placeholder?: string;
  removeLabel: (tag: string) => string;
}) {
  const [tags, setTags] = React.useState(defaultValue);
  const [draft, setDraft] = React.useState("");

  function addTags(value: string) {
    const additions = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setTags((current) => {
      const next = [...current];
      for (const addition of additions) {
        if (!next.some((tag) => tag.toLowerCase() === addition.toLowerCase())) {
          next.push(addition);
        }
      }
      return next;
    });
    setDraft("");
  }

  function removeTag(tagToRemove: string) {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={name}>{label}</Label>
      <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-input bg-field px-2 py-1 text-field-foreground shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring">
        {tags.map((tag) => (
          <Tag className="pr-1" key={tag}>
            {tag}
            <button
              aria-label={removeLabel(tag)}
              className="rounded-full p-0.5 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => removeTag(tag)}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          </Tag>
        ))}
        <input name={name} type="hidden" value={tags.join(",")} />
        <input
          autoComplete="off"
          className="min-w-24 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-field-foreground/60"
          id={name}
          onBlur={() => draft.trim() && addTags(draft)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTags(draft);
            } else if (event.key === "Backspace" && !draft && tags.length) {
              setTags((current) => current.slice(0, -1));
            }
          }}
          placeholder={tags.length ? undefined : placeholder}
          value={draft}
        />
      </div>
    </div>
  );
}
