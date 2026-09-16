import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-100 text-primary-700",
        secondary: "border-transparent bg-secondary-100 text-secondary-700",
        role: "border-transparent bg-secondary-100 text-secondary-700",
        department: "border-transparent bg-secondary-100 text-secondary-700",
        success: "border-transparent bg-success-light text-success-dark",
        warning: "border-transparent bg-warning-light text-warning-dark",
        danger: "border-transparent bg-danger-light text-danger-dark",
        info: "border-transparent bg-info-light text-info-dark",
        destructive: "border-transparent bg-danger-light text-danger-dark",
        outline: "border-border bg-neutral-100 text-neutral-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
