import * as React from "react";
import { cn } from "@/lib/utils";

export const controlClass =
  "h-9 w-full min-w-0 rounded-[10px] border border-line-2 bg-panel-2 px-2.5 text-[13.5px] text-fg placeholder:text-faint transition-[border-color,box-shadow] hover:border-line-2 focus-visible:border-blue disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, "h-auto min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-semibold text-muted", className)} {...props} />;
}

export function Hint({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("text-[11.5px] font-medium text-faint", className)} {...props} />;
}

/** Label + control + optional hint, stacked. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      {htmlFor ? <Label htmlFor={htmlFor}>{label}</Label> : <span className="text-xs font-semibold text-muted">{label}</span>}
      {children}
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}
