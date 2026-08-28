import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { createPortal } from "react-dom";

export function Toaster() {
  const { toasts } = useToast();

  const content = (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="!z-[99999]">
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      {/*
        Portaled + fixed to escape any parent overflow/transform stacking contexts
        (e.g. chat layout containers)
      */}
      <ToastViewport className="!fixed !z-[99999]" style={{ zIndex: 99999 }} />
    </ToastProvider>
  );

  // Ensure we escape any ancestor overflow/transform by portaling to <body>
  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return content;
}
