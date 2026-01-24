import React from "react";
import { Button } from "@/components/ui/button";

interface PartyStartButtonProps {
  onStart: () => void;
}

const PartyStartButton: React.FC<PartyStartButtonProps> = ({ onStart }) => {
  const handleClick = () => {
    onStart();
  };
  return (
    <div className="flex justify-center my-8">
      <Button onClick={handleClick} variant="default" size="lg" aria-label="Rozpocznij imprezę">
        Rozpocznij nową imprezę
      </Button>
    </div>
  );
};

export default PartyStartButton;
