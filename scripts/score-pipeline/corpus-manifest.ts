export const CORPUS_BASELINE = {
  pptx_count: 712,
  slide_count: 2658,
  simpmusic_base_pptx_count: 709,
  simpmusic_accent_pptx_count: 173,
  jpg_count: 747,
  alternate_tune_count: 35,
} as const;

export const STRUCTURED_SCORE_FALLBACKS = {
  "60": {
    pptx_filename: "060 乐哉白白恩典.pptx",
    reason: "PPTX 不含 SimpMusic Base 结构化谱面",
  },
  "63": {
    pptx_filename: "063 恩爱标本.pptx",
    reason: "PPTX 不含 SimpMusic Base 结构化谱面",
  },
  "444": {
    pptx_filename: "444 我魂安息在于羔羊.pptx",
    reason: "PPTX 不含 SimpMusic Base 结构化谱面",
  },
} as const;

export type StructuredFallbackHymnKey =
  keyof typeof STRUCTURED_SCORE_FALLBACKS;

export interface CorpusObservation {
  pptx_count: number;
  slide_count: number;
  simpmusic_base_pptx_count: number;
  simpmusic_accent_pptx_count: number;
  jpg_count: number;
  alternate_tune_count: number;
  base_hymn_numbers: readonly number[];
  no_base_pptx_filenames: readonly string[];
}

export interface CorpusMismatch {
  field: string;
  expected: number | string;
  actual: number | string;
}

export function validateCorpusObservation(
  observation: CorpusObservation,
): CorpusMismatch[] {
  const mismatches: CorpusMismatch[] = [];
  for (const field of Object.keys(CORPUS_BASELINE) as Array<
    keyof typeof CORPUS_BASELINE
  >) {
    if (observation[field] !== CORPUS_BASELINE[field]) {
      mismatches.push({
        field,
        expected: CORPUS_BASELINE[field],
        actual: observation[field],
      });
    }
  }

  const expectedNumbers = Array.from({ length: 712 }, (_, index) => index + 1);
  const actualNumbers = [...new Set(observation.base_hymn_numbers)].sort(
    (left, right) => left - right,
  );
  if (
    actualNumbers.length !== expectedNumbers.length ||
    actualNumbers.some((number, index) => number !== expectedNumbers[index])
  ) {
    mismatches.push({
      field: "base_hymn_numbers",
      expected: "1..712",
      actual: actualNumbers.join(","),
    });
  }

  const expectedFallbacks = Object.values(STRUCTURED_SCORE_FALLBACKS)
    .map((item) => item.pptx_filename)
    .sort();
  const actualFallbacks = [...observation.no_base_pptx_filenames].sort();
  if (
    actualFallbacks.length !== expectedFallbacks.length ||
    actualFallbacks.some(
      (filename, index) => filename !== expectedFallbacks[index],
    )
  ) {
    mismatches.push({
      field: "no_base_pptx_filenames",
      expected: expectedFallbacks.join(","),
      actual: actualFallbacks.join(","),
    });
  }

  return mismatches;
}
