import React from "react";
import { Button } from "@/components/ui/button";

interface PartyStartButtonProps {
  onStart: () => Promise<void> | void;
}

const PartyStartButton: React.FC<PartyStartButtonProps> = ({ onStart }) => {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await Promise.resolve(onStart());
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("PartyStartButton error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center my-8">
      <Button
        onClick={handleClick}
        disabled={isLoading}
        variant="default"
        size="lg"
        aria-label="Rozpocznij imprezę"
        data-testid="start-party-btn"
      >
        {isLoading ? "Uruchamianie..." : "Rozpocznij nową imprezę"}
      </Button>
    </div>
  );
};

export default PartyStartButton;
