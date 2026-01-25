import React from "react";
import type { DrinkPreview } from "../types";

interface DrinkPreviewListProps {
  drinks: DrinkPreview[];
}

const DrinkPreviewList: React.FC<DrinkPreviewListProps> = React.memo(({ drinks }) => {
  const renderedDrinks = React.useMemo(() => {
    if (!drinks || drinks.length === 0) {
      return <span className="text-neutral-400">Brak napojów</span>;
    }
    return (
      <ul className="flex flex-row gap-2">
        {drinks.slice(0, 3).map((drink) => (
          <li key={drink.id} className="flex flex-col items-center">
            <span className="w-6 h-6 bg-blue-200 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-bold">
              {drink.abv_percent}%
            </span>
            <span className="text-xs text-neutral-500">{drink.volume_ml}ml</span>
          </li>
        ))}
        {drinks.length > 3 && <li className="text-xs text-neutral-500">+{drinks.length - 3}</li>}
      </ul>
    );
  }, [drinks]);
  return renderedDrinks;
});
DrinkPreviewList.displayName = "DrinkPreviewList";

export default DrinkPreviewList;
