import React from "react";
import { GlobalAlertsProvider } from "../components/GlobalAlertsProvider";

interface FrameworkProps {
  children: React.ReactNode;
}

const Framework: React.FC<FrameworkProps> = ({ children }) => {
  return <GlobalAlertsProvider>{children}</GlobalAlertsProvider>;
};

export default Framework;
