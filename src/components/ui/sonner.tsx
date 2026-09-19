import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { AlertCircle, CheckCircle2, Info, LoaderCircle, TriangleAlert } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      duration={4500}
      closeButton
      visibleToasts={4}
      gap={10}
      icons={{
        success: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
        error: <AlertCircle className="h-5 w-5" aria-hidden="true" />,
        warning: <TriangleAlert className="h-5 w-5" aria-hidden="true" />,
        info: <Info className="h-5 w-5" aria-hidden="true" />,
        loading: <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !min-h-[64px] !rounded-md !border !border-border !bg-card !px-4 !py-3 !font-sans !text-foreground !shadow-card",
          title: "!text-sm !font-semibold !leading-5 !text-foreground",
          description: "!text-sm !leading-5 !text-muted-foreground",
          icon: "!h-5 !w-5 !shrink-0",
          success: "!border-l-4 !border-l-success [&_[data-icon]]:!text-success-foreground",
          error: "!border-l-4 !border-l-destructive [&_[data-icon]]:!text-destructive",
          warning: "!border-l-4 !border-l-warning [&_[data-icon]]:!text-warning-foreground",
          info: "!border-l-4 !border-l-info [&_[data-icon]]:!text-info-foreground",
          loading: "!border-l-4 !border-l-info [&_[data-icon]]:!text-info-foreground",
          actionButton:
            "!h-8 !rounded-md !bg-primary !px-3 !text-xs !font-semibold !text-primary-foreground hover:!bg-primary-700 focus:!ring-2 focus:!ring-ring focus:!ring-offset-2",
          cancelButton:
            "!h-8 !rounded-md !bg-muted !px-3 !text-xs !font-semibold !text-muted-foreground hover:!text-foreground focus:!ring-2 focus:!ring-ring focus:!ring-offset-2",
          closeButton:
            "!left-auto !right-2 !top-2 !h-6 !w-6 !translate-x-0 !translate-y-0 !rounded-md !border-border !bg-card !text-muted-foreground hover:!bg-muted hover:!text-foreground focus:!ring-2 focus:!ring-ring",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
