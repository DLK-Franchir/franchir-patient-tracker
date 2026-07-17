import { describe, expect, it } from "vitest";
import {
  formatFormTypesLabel,
  formTypesFromSpineRegionLabel,
  normalizeDbFormTypes,
  resolveParcoursDisplayLabel,
} from "./spine-region-label";

describe("spine-region-label", () => {
  it("normalizes and labels form types", () => {
    expect(normalizeDbFormTypes(["lombaire", "cervical", "cervical"])).toEqual([
      "cervical",
      "lombaire",
    ]);
    expect(formatFormTypesLabel(["lombaire", "cervical"])).toBe("Cervical + Lombaire");
    expect(formatFormTypesLabel(["lombaire"])).toBe("Lombaire");
  });

  it("round-trips labels", () => {
    expect(formTypesFromSpineRegionLabel("Cervical + Lombaire")).toEqual([
      "cervical",
      "lombaire",
    ]);
    expect(formTypesFromSpineRegionLabel("unknown")).toBeNull();
  });

  it("resolves parcours display with preview label winning", () => {
    expect(
      resolveParcoursDisplayLabel({
        spineRegionLabel: "Lombaire",
        formTypes: ["cervical"],
      }),
    ).toBe("Lombaire");
    expect(resolveParcoursDisplayLabel({ formTypes: ["cervical"] })).toBe("Cervical");
  });
});
