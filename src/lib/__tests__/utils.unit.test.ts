import { describe, it, expect } from "vitest";
import { cn } from "../utils";

// Testy jednostkowe dla funkcji cn

describe("cn utility", () => {
  it("łączy pojedynczy string", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("łączy wiele stringów", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("ignoruje wartości falsy", () => {
    expect(cn("foo", false, null, undefined, "", "bar")).toBe("foo bar");
  });

  it("obsługuje obiekty z warunkami", () => {
    expect(cn("foo", { bar: true, baz: false })).toBe("foo bar");
  });

  it("scalanie klas Tailwind (twMerge)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("obsługuje tablice klas", () => {
    expect(cn(["foo", "bar"], "baz")).toBe("foo bar baz");
  });

  it("zwraca pusty string dla pustych wejść", () => {
    expect(cn()).toBe("");
    expect(cn("", false, null, undefined)).toBe("");
  });
});
