export type EncodingType = "bijoy" | "corrupted_unicode" | "valid_unicode" | "mixed" | "empty";

export interface ConversionHistoryItem {
  id: string;
  timestamp: number;
  inputSnippet: string;
  fullInput: string;
  output: string;
  detectedType: EncodingType;
  mode: "ai" | "instant";
  wordCount: number;
  charCount: number;
}

export interface SampleText {
  id: string;
  title: string;
  badge: string;
  text: string;
}
