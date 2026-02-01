import React from "react";
import { Button } from "@/components/ui/button";
import type { PartyDetailDTO } from "../types";

interface BlackoutModalProps {
  party: PartyDetailDTO | null;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const BlackoutModal: React.FC<BlackoutModalProps> = ({ party, open, onConfirm, onCancel }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="blackout-modal"
      style={{ display: open && party ? "flex" : "none" }}
    >
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">Czy wystąpił blackout?</h2>
        <p className="mb-4">
          Czy podczas tej imprezy wystąpił blackout (urwanie filmu)? Ta informacja pomoże w lepszej analizie Twoich
          danych.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} data-testid="blackout-no-btn">
            Nie
          </Button>
          <Button variant="default" onClick={onConfirm} data-testid="blackout-yes-btn">
            Tak
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BlackoutModal;
