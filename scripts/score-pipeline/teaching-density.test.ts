import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  FingerAssignment,
  PianoArrangementDocument,
} from "../../src/features/score/contracts";

async function arrangement(
  hymnKey: "1" | "118",
): Promise<PianoArrangementDocument> {
  return JSON.parse(
    await readFile(
      resolve(`public/materials/hymns/${hymnKey}/arrangement.json`),
      "utf8",
    ),
  ) as PianoArrangementDocument;
}

function fingeringDigest(fingerings: FingerAssignment[]): string {
  const stableFingerings = fingerings.map(
    ({ event_id, finger, hand, status, confidence, reason }) => ({
      event_id,
      finger,
      hand,
      status,
      confidence,
      reason,
    }),
  );
  return createHash("sha256")
    .update(JSON.stringify(stableFingerings))
    .digest("hex");
}

describe("生成教学层密度", () => {
  it("[defect-probing] 第 1 首手位不超过 8 段且换位不超过 6 次", async () => {
    const result = await arrangement("1");

    expect(result.positions.length).toBeLessThanOrEqual(8);
    expect(result.moves.length).toBeLessThanOrEqual(6);
  });

  it("[defect-probing] 第 118 首手位与换位相对基线至少下降 50%", async () => {
    const result = await arrangement("118");

    expect(result.positions.length).toBeLessThanOrEqual(11);
    expect(result.moves.length).toBeLessThanOrEqual(7);
  });

  it("密度归并不改变第 1 首与第 118 首的逐音指法", async () => {
    const first = await arrangement("1");
    const oneHundredEighteen = await arrangement("118");

    expect(fingeringDigest(first.fingerings)).toBe(
      "07dc9460595f93eafa802efa2abad8f5e0061e9138df4d1c55655e3b97218b5e",
    );
    expect(fingeringDigest(oneHundredEighteen.fingerings)).toBe(
      "975116f7f28784c4cbb5f924a252d8de46f1a8ec335b5c93139cd93883ff4082",
    );
  });
});
