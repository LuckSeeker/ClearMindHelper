import React from "react";

interface ErrorMessageProps {
  message?: string;
  ariaLive?: boolean;
}

const ErrorMessage = React.forwardRef<HTMLDivElement, ErrorMessageProps>(({ message, ariaLive }, ref) => {
  if (!message) return null;
  return (
    <div
      className="w-full bg-destructive/10 text-destructive text-sm rounded p-2 mb-2"
      role="alert"
      aria-live={ariaLive ? "assertive" : undefined}
      tabIndex={-1}
      ref={ref}
    >
      <span>{message}</span>
    </div>
  );
});
ErrorMessage.displayName = "ErrorMessage";

export { ErrorMessage };
