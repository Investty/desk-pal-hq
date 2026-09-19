import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  requiredMessage?: string;
}

const humanizeFieldName = (value?: string) => {
  if (!value) return "this field";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\bpw2?\b/i, "password")
    .replace(/\bemail\b/i, "Email Address")
    .replace(/\bname\b/i, "Name")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, requiredMessage, onInvalid, onInput, ...props }, ref) => {
    const fallbackName = props["aria-label"] || props.name || props.id;

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-base ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        onInvalid={(event) => {
          if (event.currentTarget.validity.valueMissing) {
            event.currentTarget.setCustomValidity(
              requiredMessage || `Please enter ${humanizeFieldName(fallbackName)}`,
            );
          }
          onInvalid?.(event);
        }}
        onInput={(event) => {
          event.currentTarget.setCustomValidity("");
          onInput?.(event);
        }}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
