import { describe, expect, it } from "vitest";
import { severityClassForRow } from "./score-severity";
import type { FunctionalScoreRow } from "./types";

function evaRow(value: number | null): FunctionalScoreRow {
  return { id: "eva", label: "EVA", value, max: 10, interpretation: "" };
}

function pctRow(value: number | null): FunctionalScoreRow {
  return { id: "ndi", label: "NDI", value, max: 100, interpretation: "" };
}

describe("severityClassForRow", () => {
  it("uses brand mid-tone for questionnaires EVA scores", () => {
    expect(severityClassForRow(evaRow(4), "questionnaires")).toBe("bg-brand");
  });

  it("uses tracker blue mid-tone for tracker EVA scores", () => {
    expect(severityClassForRow(evaRow(4), "tracker")).toBe("bg-[#2563EB]");
  });

  it("maps disability percentages to severity bands", () => {
    expect(severityClassForRow(pctRow(15), "questionnaires")).toBe("bg-dash-teal");
    expect(severityClassForRow(pctRow(35), "tracker")).toBe("bg-[#2563EB]");
    expect(severityClassForRow(pctRow(55), "questionnaires")).toBe("bg-dash-gold");
    expect(severityClassForRow(pctRow(75), "tracker")).toBe("bg-dash-coral");
  });

  it("returns neutral class when value is null", () => {
    expect(severityClassForRow(evaRow(null), "questionnaires")).toBe("bg-neutral-text-subtle");
    expect(severityClassForRow(pctRow(null), "tracker")).toBe("bg-neutral-text-subtle");
  });
});
