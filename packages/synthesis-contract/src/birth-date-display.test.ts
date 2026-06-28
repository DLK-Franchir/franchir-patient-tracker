import { describe, expect, it } from "vitest";
import {
  calcAgeFromBirthDate,
  formatBirthDateFr,
  parsePatientBirthDate,
  resolveBirthDateRaw,
} from "./birth-date-display";

describe("birth-date-display", () => {
  it("parses JJ/MM/AAAA questionnaire format", () => {
    const d = parsePatientBirthDate("14/05/1980");
    expect(d?.getFullYear()).toBe(1980);
    expect(d?.getMonth()).toBe(4);
    expect(d?.getDate()).toBe(14);
  });

  it("parses ISO dates", () => {
    const d = parsePatientBirthDate("1980-05-14");
    expect(d?.getFullYear()).toBe(1980);
  });

  it("formats French birth dates for display", () => {
    expect(formatBirthDateFr("14/05/1980")).toMatch(/14.*1980/);
  });

  it("computes age without double-format regression", () => {
    const raw = "14/05/1980";
    const formatted = formatBirthDateFr(raw);
    expect(calcAgeFromBirthDate(raw)).toMatch(/\d+ ans/);
    expect(calcAgeFromBirthDate(formatted)).toBeNull();
  });

  it("resolves canonical birth_date key from answers", () => {
    expect(resolveBirthDateRaw({ birth_date: "14/05/1980" })).toBe("14/05/1980");
    expect(resolveBirthDateRaw({ identity_birth_date: "01/01/1990" })).toBe("01/01/1990");
  });
});
