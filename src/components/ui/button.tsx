import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive";

const variants: Record<Variant, string> = {
  default:
    "bg-gradient-to-b from-gold-bright to-gold text-[#0a0a0b] hover:from-gold hover:to-gold-dim shadow-[0_0_20px_rgba(201,162,39,0.25)]",
  secondary: "bg-white/8 text-foreground hover:bg-white/12 border border-gold/20",
  outline: "border border-gold/35 bg-transparent text-foreground hover:bg-gold/10",
  ghost: "text-muted hover:bg-white/5 hover:text-foreground",
  destructive: "bg-red-700 text-white hover:bg-red-800",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "default", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50",
      variants[variant],
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";
