import React from "react";

interface SwitchAuthLinkProps {
  to: string;
  children: React.ReactNode;
}

export const SwitchAuthLink: React.FC<SwitchAuthLinkProps> = ({ to, children }) => (
  <a href={to} className="text-primary hover:underline focus:underline focus:outline-none">
    {children}
  </a>
);
