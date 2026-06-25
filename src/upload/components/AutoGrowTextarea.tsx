"use client";

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from "react";

type AutoGrowTextareaProps = Omit<
  ComponentPropsWithoutRef<"textarea">,
  "onChange" | "rows"
> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * A textarea that wraps and grows in height to fit its content, but behaves like
 * a single-line field: line breaks are never inserted (Enter is ignored, pasted
 * newlines are stripped), so the value stays free of "\n".
 */
export default function AutoGrowTextarea({
  value,
  onChange,
  className,
  onKeyDown,
  ...rest
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={1}
      value={value}
      className={className}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
        onKeyDown?.(e);
      }}
      onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, " "))}
    />
  );
}
