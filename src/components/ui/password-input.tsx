import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, type InputProps } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const actionLabel = visible ? "Hide password" : "Show password";

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-11", className)}
          {...props}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 border-0 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
              aria-label={actionLabel}
              aria-pressed={visible}
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{actionLabel}</TooltipContent>
        </Tooltip>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };