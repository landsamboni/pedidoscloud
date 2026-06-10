import { describe, expect, it } from "vitest";
import { addressMessage, nameMessage, normalizePhone, phoneMessage } from "@/lib/validation";

describe("nameMessage", () => {
  it("rejects empty, too short, and single-word names", () => {
    expect(nameMessage("")).toBeTruthy();
    expect(nameMessage("Ana")).toBeTruthy(); // < 5 chars
    expect(nameMessage("Juan")).toBeTruthy(); // single word
    expect(nameMessage("x".repeat(200))).toBeTruthy(); // too long
  });
  it("accepts a full name", () => {
    expect(nameMessage("Juan Pérez")).toBeNull();
  });
});

describe("phoneMessage", () => {
  it("requires 10 digits starting with 3", () => {
    expect(phoneMessage("300123")).toBeTruthy();
    expect(phoneMessage("1001234567")).toBeTruthy(); // does not start with 3
    expect(phoneMessage("3001234567")).toBeNull();
  });
});

describe("addressMessage", () => {
  it("rejects empty, too short, and digit-less addresses", () => {
    expect(addressMessage("")).toBeTruthy();
    expect(addressMessage("Cra 5")).toBeTruthy(); // too short
    expect(addressMessage("Calle sin numero aqui")).toBeTruthy(); // no digit
  });
  it("accepts a specific address", () => {
    expect(addressMessage("Cra 5 #12-34 apto 301")).toBeNull();
  });
});

describe("normalizePhone", () => {
  it("strips non-digits and caps at 10", () => {
    expect(normalizePhone("(300) 123-4567")).toBe("3001234567");
    expect(normalizePhone("300123456789")).toBe("3001234567");
  });
});
