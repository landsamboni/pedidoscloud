import { describe, expect, it } from "vitest";
import { itemSurcharge, parseItemName, parseSurcharge } from "@/lib/menu";

describe("parseItemName / parseSurcharge", () => {
  it("parses the '+N' surcharge notation", () => {
    expect(parseItemName("Costilla BBQ +3000")).toBe("Costilla BBQ");
    expect(parseSurcharge("Costilla BBQ +3000")).toBe(3000);
  });
  it("parses the legacy '|N' notation", () => {
    expect(parseItemName("Costilla BBQ|3000")).toBe("Costilla BBQ");
    expect(parseSurcharge("Costilla BBQ|3000")).toBe(3000);
  });
  it("returns 0 surcharge when none is present", () => {
    expect(parseItemName("Pollo asado")).toBe("Pollo asado");
    expect(parseSurcharge("Pollo asado")).toBe(0);
  });
  it("never returns a negative surcharge", () => {
    expect(parseSurcharge("Algo +-5")).toBe(0);
  });
});

describe("itemSurcharge", () => {
  it("sums the four combo components", () => {
    expect(itemSurcharge("Sopa +1000", "Pollo +2000", "Papa", "Jugo +500")).toBe(3500);
    expect(itemSurcharge("Sopa", "Pollo", "Papa", "Jugo")).toBe(0);
  });
});
