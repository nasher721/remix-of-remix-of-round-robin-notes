import { test, expect } from "vitest";
import { cn } from "@/lib/utils";

test("cn merges class strings", () => {
  const result = cn("btn", "btn-primary", "text-sm");
  expect(result).toBe("btn btn-primary text-sm");
});

test("cn handles falsy and conditional values", () => {
  const result = cn(
    "base",
    null,
    undefined,
    false,
    "",
    { hidden: false, block: true, active: true }
  );

  expect(result).toBe("base block active");
});

test("cn deduplicates conflicting Tailwind classes with last-wins merge", () => {
  const result = cn("px-2", "px-4", "md:px-2", "px-6");
  expect(result).toBe("md:px-2 px-6");
});

test("cn flattens nested arrays and objects", () => {
  const result = cn(
    "p-2",
    ["mt-2", ["text-sm", { hidden: false, block: true }]],
    "leading-tight"
  );

  expect(result).toBe("p-2 mt-2 text-sm block leading-tight");
});

test("cn resolves mutually exclusive Tailwind variants", () => {
  const result = cn("bg-red-500", "bg-red-600", "hover:bg-red-700", {
    "bg-red-400": false,
  });

  expect(result).toBe("bg-red-600 hover:bg-red-700");
});
