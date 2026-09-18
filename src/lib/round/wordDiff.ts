/**
 * Zero-dependency word-level diff utility.
 * Compares two strings by splitting them into word/whitespace tokens
 * and computing the Longest Common Subsequence (LCS) diff.
 * Optimized for bedside clinical note conflict inspection (<2KB footprint).
 */

export interface DiffSegment {
  type: "same" | "added" | "removed";
  value: string;
}

/**
 * Tokenize a text string into alternating words and whitespace tokens.
 */
export function tokenizeWords(text: string): string[] {
  if (!text) return [];
  const tokens = text.match(/[\w]+|[^\w\s]+|\s+/g);
  return tokens ?? [text];
}

/**
 * Compute the word-level diff between original (textA) and modified (textB).
 * textA items not in textB are marked "removed".
 * textB items not in textA are marked "added".
 */
export function computeWordDiff(textA: string, textB: string): DiffSegment[] {
  if (textA === textB) {
    return textA ? [{ type: "same", value: textA }] : [];
  }
  if (!textA) {
    return textB ? [{ type: "added", value: textB }] : [];
  }
  if (!textB) {
    return textA ? [{ type: "removed", value: textA }] : [];
  }

  const tokensA = tokenizeWords(textA);
  const tokensB = tokenizeWords(textB);

  const m = tokensA.length;
  const n = tokensB.length;

  // For very long texts, cap the matrix calculation to prevent main-thread lag
  if (m * n > 40000) {
    return [
      { type: "removed", value: textA },
      { type: "added", value: textB },
    ];
  }

  // Build standard LCS length table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (tokensA[i] === tokensB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to build raw diff operations
  const rawSegments: DiffSegment[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tokensA[i - 1] === tokensB[j - 1]) {
      rawSegments.unshift({ type: "same", value: tokensA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawSegments.unshift({ type: "added", value: tokensB[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      rawSegments.unshift({ type: "removed", value: tokensA[i - 1] });
      i--;
    }
  }

  // Merge contiguous segments of the same type for clean rendering
  const merged: DiffSegment[] = [];
  for (const seg of rawSegments) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === seg.type) {
      prev.value += seg.value;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}
