/**
 * Comprehensive Bengali Text Repair and Normalization Utility
 * Handles Bijoy/SutonnyMJ ANSI to Unicode conversion and repairing corrupted Unicode text.
 */
import { convertBijoyToUnicode as rawBijoyToUnicode, looksLikeBijoy, hasBengaliUnicode } from "bijoy2unicode";

export interface ConversionResult {
  text: string;
  sourceType: "bijoy" | "corrupted_unicode" | "valid_unicode" | "mixed" | "empty";
  charCount: number;
  wordCount: number;
  appliedRepairs: string[];
}

/**
 * Detect what kind of text the user input is
 */
export function detectBengaliEncoding(text: string): "bijoy" | "corrupted_unicode" | "valid_unicode" | "mixed" | "empty" {
  if (!text || !text.trim()) return "empty";

  const isBijoy = looksLikeBijoy(text);
  const hasUnicode = hasBengaliUnicode(text);

  // Check for common signs of corrupted Bengali Unicode (misplaced pre-vowels, split conjuncts)
  const hasMisplacedPreVowels = /[\u09C7\u09BF\u09C8][\u0995-\u09B9]/.test(text);
  const hasSplitConjuncts = /[\u0995-\u09B9]\s+[\u09CD\u09BE-\u09CC]/.test(text);
  const hasLatinDari = /[\u0980-\u09FF]\s*\|/.test(text);

  if (isBijoy && !hasUnicode) {
    return "bijoy";
  }
  if (isBijoy && hasUnicode) {
    return "mixed";
  }
  if (hasUnicode && (hasMisplacedPreVowels || hasSplitConjuncts || hasLatinDari)) {
    return "corrupted_unicode";
  }
  if (hasUnicode) {
    return "valid_unicode";
  }
  // If text contains high ANSI or common SutonnyMJ characters like 'Avwg'
  if (/([A-Z][a-z]+|[v-z~¡-ÿ])/.test(text)) {
    return "bijoy";
  }
  return "valid_unicode";
}

/**
 * Reorders and repairs corrupted Bengali Unicode text:
 * - Fixes misplaced e-kar, i-kar, oi-kar (placed before consonant instead of after)
 * - Fixes split o-kar and ou-kar
 * - Fixes broken conjuncts with rogue spaces
 * - Normalizes ya-phala, ra-phala, ref
 * - Converts Latin pipe '|' to Bengali dari '।'
 */
export function repairCorruptedUnicode(text: string): { repaired: string; repairs: string[] } {
  const repairs: string[] = [];

  // Normalize common Windows ANSI e-kar code points (0x87)
  let result = text.replace(/\u0087/g, "\u09C7");

  // 1. Convert stray ASCII pipes '|' after Bengali words to Bengali dari '।'
  if (/([\u0980-\u09FF])\s*\|/.test(result)) {
    result = result.replace(/([\u0980-\u09FF])\s*\|/g, "$1 ।");
    repairs.push("দাঁড়ি চিহ্ন সংশোধন (| -> ।)");
  }

  // 2. Fix split o-kar: e-kar (09C7) + consonant(s) + aa-kar (09BE) -> consonant(s) + o-kar (09CB)
  if (/(^|[^\u0995-\u09B9\u09CD])\u09C7([\u0995-\u09B9](?:\u09CD[\u0995-\u09B9])?)\u09BE/.test(result)) {
    result = result.replace(/(^|[^\u0995-\u09B9\u09CD])\u09C7([\u0995-\u09B9](?:\u09CD[\u0995-\u09B9])?)\u09BE/g, (_m, prefix, p1) => {
      return prefix + p1 + "\u09CB";
    });
    repairs.push("বিভক্ত ও-কার (ো) সংশোধন");
  }

  // 3. Fix split ou-kar: e-kar (09C7) + consonant(s) + 09D7 -> consonant(s) + ou-kar (09CC)
  if (/(^|[^\u0995-\u09B9\u09CD])\u09C7([\u0995-\u09B9](?:\u09CD[\u0995-\u09B9])?)\u09D7/.test(result)) {
    result = result.replace(/(^|[^\u0995-\u09B9\u09CD])\u09C7([\u0995-\u09B9](?:\u09CD[\u0995-\u09B9])?)\u09D7/g, (_m, prefix, p1) => {
      return prefix + p1 + "\u09CC";
    });
    repairs.push("বিভক্ত ঔ-কার (ৌ) সংশোধন");
  }

  // 4. Fix misplaced pre-vowels (e-kar, i-kar, oi-kar) placed BEFORE conjunct or consonant
  if (/(^|[^\u0995-\u09B9\u09CD])([\u09C7\u09BF\u09C8])([\u0995-\u09B9](?:\u09CD[\u0995-\u09B9])+)/.test(result)) {
    result = result.replace(
      /(^|[^\u0995-\u09B9\u09CD])([\u09C7\u09BF\u09C8])([\u0995-\u09B9](?:\u09CD[\u0995-\u09B9])+)/g,
      (_m, prefix, kar, cluster) => prefix + cluster + kar
    );
    repairs.push("যুক্তাক্ষরে পূর্বে থাকা কার চিহ্ন সংশোধন");
  }

  if (/(^|[^\u0995-\u09B9\u09CD])([\u09C7\u09BF\u09C8])([\u0995-\u09B9])/.test(result)) {
    result = result.replace(
      /(^|[^\u0995-\u09B9\u09CD])([\u09C7\u09BF\u09C8])([\u0995-\u09B9])/g,
      (_m, prefix, kar, cons) => prefix + cons + kar
    );
    repairs.push("ব্যঞ্জনবর্ণের পূর্বে থাকা কার চিহ্ন পুনর্বিন্যাস");
  }

  // 5. Fix split spaces in conjuncts (e.g. ক্ + ত -> ক্ত)
  if (/([\u0995-\u09B9]\u09CD)\s+([\u0995-\u09B9])/.test(result)) {
    result = result.replace(/([\u0995-\u09B9]\u09CD)\s+([\u0995-\u09B9])/g, "$1$2");
    repairs.push("যুক্তবর্ণের ফাঁকা স্থান অপসারণ");
  }

  // 6. Fix spaces between consonant and following vowel kar
  if (/([\u0995-\u09B9])\s+([\u09BE-\u09CD])/g.test(result)) {
    result = result.replace(/([\u0995-\u09B9])\s+([\u09BE-\u09CD])/g, "$1$2");
    repairs.push("কার চিহ্নের অপ্রয়োজনীয় স্পেস সংশোধন");
  }

  // 7. Fix duplicate halants
  if (/([\u0995-\u09B9])\u09CD\u09AF\u09BE/.test(result)) {
    result = result.replace(/\u09CD\u09CD+/g, "\u09CD");
  }

  // 8. Clean up zero-width non-joiner / joiner artifacts
  if (/[\u200C\u200D\uFEFF]/.test(result)) {
    result = result.replace(/\u200C\u200D/g, "").replace(/\uFEFF/g, "");
    repairs.push("অদৃশ্য ইউনিকোড কন্ট্রোল ক্যারেক্টার ফিল্টার");
  }

  // 9. Clean stray dotted circle (\u25CC) and standalone halants at word start
  if (/[\u25CC]/.test(result) || /(^|[\s\(\[\{"' ?,;:-])\u09CD+/.test(result)) {
    result = result.replace(/\u25CC/g, "");
    result = result.replace(/(^|[\s\(\[\{"' ?,;:-])\u09CD+/g, "$1");
    repairs.push("অনাকাঙ্ক্ষিত চিহ্ন ও ডটেড সার্কেল দূরীকরণ");
  }

  return { repaired: result, repairs: Array.from(new Set(repairs)) };
}

/**
 * Full deterministic pipeline:
 * Converts Bijoy/SutonnyMJ to Unicode and applies Unicode normalization
 */
export function convertAndRepairBengali(text: string): ConversionResult {
  if (!text || !text.trim()) {
    return {
      text: "",
      sourceType: "empty",
      charCount: 0,
      wordCount: 0,
      appliedRepairs: [],
    };
  }

  const sourceType = detectBengaliEncoding(text);
  const appliedRepairs: string[] = [];
  let processed = text;

  // Step 1: If Bijoy, Mixed, or contains lines/tokens of Bijoy
  const containsBijoyTokens = /([A-Za-z~¡-ÿ]{3,})/.test(processed);

  if (sourceType === "bijoy" || looksLikeBijoy(processed)) {
    try {
      processed = rawBijoyToUnicode(processed);
      appliedRepairs.push("বিজয় (SutonnyMJ/ANSI) থেকে ইউনিকোডে রূপান্তর");
    } catch (e) {
      console.error("Bijoy conversion error:", e);
    }
  } else if (sourceType === "mixed" || containsBijoyTokens) {
    try {
      const lines = processed.split("\n");
      const convertedLines = lines.map((line) => {
        if (!hasBengaliUnicode(line) && /[a-zA-Z~¡-ÿ]/.test(line)) {
          try {
            return rawBijoyToUnicode(line);
          } catch {
            return line;
          }
        }
        return line.replace(/([a-zA-Z~¡-ÿ]{2,})/g, (token) => {
          try {
            const converted = rawBijoyToUnicode(token);
            return hasBengaliUnicode(converted) ? converted : token;
          } catch {
            return token;
          }
        });
      });
      processed = convertedLines.join("\n");
      appliedRepairs.push("মিশ্র টেক্সটের বিজয় অংশসমূহ রূপান্তর");
    } catch (e) {
      console.error("Mixed conversion error:", e);
    }
  }

  // Step 2: Repair any broken/misplaced Unicode conjuncts and vowels
  const { repaired, repairs } = repairCorruptedUnicode(processed);
  processed = repaired;
  appliedRepairs.push(...repairs);

  const charCount = processed.length;
  const wordCount = processed.trim().split(/\s+/).filter(Boolean).length;

  return {
    text: processed,
    sourceType,
    charCount,
    wordCount,
    appliedRepairs,
  };
}
