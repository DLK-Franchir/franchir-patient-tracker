import { describe, expect, it } from "vitest";
import type { QuestionnaireSynthesisPreview } from "./preview-types";

/** Fixture minimale — toute clé top-level requise doit rester présente. */
function minimalPreview(): QuestionnaireSynthesisPreview {
  return {
    sessionId: "00000000-0000-4000-8000-000000000001",
    generatedAt: "2026-07-17T10:00:00.000Z",
    profile: {},
    flags: [],
    antecedents: [],
    treatments: [],
    timeline: [],
    imagingRows: [],
    scores: { rows: [] },
    completion: { overall: 0, status: "in_progress", sections: [] },
  };
}

const REQUIRED_TOP_LEVEL: Array<keyof QuestionnaireSynthesisPreview> = [
  "sessionId",
  "generatedAt",
  "profile",
  "flags",
  "antecedents",
  "treatments",
  "timeline",
  "imagingRows",
  "scores",
  "completion",
];

describe("QuestionnaireSynthesisPreview contract", () => {
  it("exposes all required top-level keys on a minimal fixture", () => {
    const preview = minimalPreview();
    for (const key of REQUIRED_TOP_LEVEL) {
      expect(preview).toHaveProperty(key);
    }
    expect(preview.scores).toHaveProperty("rows");
    expect(preview.completion).toMatchObject({
      overall: expect.any(Number),
      status: expect.any(String),
      sections: expect.any(Array),
    });
  });

  it("keeps sessionId / generatedAt as non-empty strings", () => {
    const preview = minimalPreview();
    expect(preview.sessionId.length).toBeGreaterThan(0);
    expect(preview.generatedAt.length).toBeGreaterThan(0);
  });
});
