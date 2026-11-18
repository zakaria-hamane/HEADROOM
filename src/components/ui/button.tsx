import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "primary-gradient text-white border-transparent shadow-[0_6px_18px_rgba(47,107,255,.32)] hover:brightness-110",
  secondary: "bg-panel-2 text-fg border-line-2 hover:border-blue",
  outline: "bg-transparent text-fg border-line-2 hover:border-blue hover:bg-panel-2",
  ghost: "bg-transparent text-muted border-transparent hover:text-fg hover:bg-panel-3",
  danger: "bg-red text-white border-transparent hover:brightness-110",
  "danger-ghost": "bg-transparent text-red border-transparent hover:bg-red/10",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px] rounded-[9px]",
  md: "h-9 px-3.5 text-[13px] rounded-[10px]",
  lg: "h-11 px-5 text-[14.5px] rounded-xl",
  icon: "size-9 rounded-[10px]",
  "icon-sm": "size-8 rounded-[9px]",
};

export function buttonVariants({ variant = "secondary", size = "md", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 border font-semibold whitespace-nowrap transition-[border-color,background-color,filter,transform,color] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({ variant, size, loading, className, children, disabled, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonVariants({ variant, size, className })} disabled={disabled || loading} {...props}>
      {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
