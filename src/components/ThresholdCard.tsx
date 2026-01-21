import React from "react";
import type { CurrentThresholdResponseDTO } from "../types";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";

interface ThresholdCardProps {
  threshold: CurrentThresholdResponseDTO | null;
  onChangeClick: () => void;
  isBlocked?: boolean;
}

const ThresholdCard: React.FC<ThresholdCardProps> = ({ threshold, onChangeClick, isBlocked }) => {
  const safeThreshold =
    typeof threshold?.threshold_bac === "number" && !isNaN(threshold.threshold_bac) ? threshold.threshold_bac : null;
  const safeReason = typeof threshold?.reason === "string" ? threshold.reason : "";
  const safeCreatedAt = threshold?.created_at ? new Date(threshold.created_at).toLocaleString() : "";
  return (
    <Card className="w-full" role="region" aria-labelledby="threshold-card-title">
      <CardHeader>
        <CardTitle id="threshold-card-title">Aktualny próg BAC</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" aria-live="polite">
          {safeThreshold !== null ? safeThreshold.toFixed(2) : "—"} ‰
        </div>
        {safeReason && (
          <div className="text-sm text-muted-foreground mt-1" id="threshold-reason">
            Powód: {safeReason}
          </div>
        )}
        {safeCreatedAt && (
          <div className="text-xs text-muted-foreground mt-1" id="threshold-date">
            Ustawiono: {safeCreatedAt}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={onChangeClick}
          disabled={isBlocked}
          variant="outline"
          aria-disabled={isBlocked}
          aria-describedby={isBlocked ? "profile-incomplete-msg" : undefined}
        >
          Zmień próg
        </Button>
        {isBlocked && (
          <span id="profile-incomplete-msg" className="sr-only">
            Uzupełnij profil, aby zmienić próg
          </span>
        )}
      </CardFooter>
    </Card>
  );
};

export default ThresholdCard;
