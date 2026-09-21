import "dotenv/config";
import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { convertAndRepairBengali } from "./src/utils/textRepair.ts";

const __dirname = typeof process !== "undefined" ? process.cwd() : "";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Lazy GoogleGenAI client initialization
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set in environment.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Deterministic Bijoy & Broken Unicode converter endpoint
app.post("/api/convert-algorithmic", (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== "string") {
      return res.status(400).json({ error: "Text must be a string" });
    }
    const result = convertAndRepairBengali(text);
    return res.json({
      convertedText: result.text,
      detectedType: result.sourceType,
      charCount: result.charCount,
      wordCount: result.wordCount,
      appliedRepairs: result.appliedRepairs,
    });
  } catch (error: any) {
    console.error("Algorithmic conversion error:", error);
    return res.status(500).json({
      error: "রূপান্তরে ত্রুটি: " + (error?.message || "Unknown error"),
    });
  }
});

let quotaCooldownUntil = 0;

async function executeGeminiWithBackoff(
  ai: any,
  params: {
    contents: any;
    config?: any;
  },
  models: string[] = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"],
  retriesPerModel: number = 2
) {
  if (Date.now() < quotaCooldownUntil) {
    const remainingSecs = Math.ceil((quotaCooldownUntil - Date.now()) / 1000);
    const quotaErr: any = new Error(`Free tier quota cooling down. Retry in ${remainingSecs}s`);
    quotaErr.status = 429;
    quotaErr.isQuota = true;
    throw quotaErr;
  }

  let lastError: any = null;
  for (const model of models) {
    for (let attempt = 0; attempt < retriesPerModel; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        if (response && response.text) {
          return { response, model };
        }
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code || 500;
        const msg = String(err?.message || "");
        const isQuotaExceeded =
          status === 429 ||
          msg.includes("quota") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("rate-limits");

        if (isQuotaExceeded) {
          quotaCooldownUntil = Date.now() + 55000;
          err.isQuota = true;
          throw err;
        }

        const isTransient =
          status === 503 ||
          msg.includes("503") ||
          msg.includes("high demand") ||
          msg.includes("UNAVAILABLE") ||
          msg.includes("temporarily unavailable");

        if (isTransient && attempt < retriesPerModel - 1) {
          const delay = (attempt + 1) * 1200 + Math.floor(Math.random() * 500);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error("All Gemini models are temporarily experiencing high demand");
}

// AI-powered text processing & repair endpoint
app.post("/api/convert-ai", async (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== "string") {
      return res.status(400).json({ error: "Text must be a string" });
    }
    if (!text.trim()) {
      return res.json({
        convertedText: "",
        charCount: 0,
        wordCount: 0,
        repaired: true,
      });
    }

    if (text.length > 8000 || Date.now() < quotaCooldownUntil || !process.env.GEMINI_API_KEY) {
      const result = convertAndRepairBengali(text);
      return res.json({
        convertedText: result.text,
        charCount: result.charCount,
        wordCount: result.wordCount,
        fallback: true,
        appliedRepairs: result.appliedRepairs,
        warning: text.length > 8000
          ? "টেক্সট বড় হওয়ায় সরাসরি অফলাইন ইঞ্জিন দিয়ে কনভার্ট করা হয়েছে।"
          : !process.env.GEMINI_API_KEY
          ? "API কি কনফিগার করা নেই, অফলাইন অ্যালগরিদম ব্যবহার করা হয়েছে।"
          : "কোটা কুলডাউনের কারণে অফলাইন ইঞ্জিন ব্যবহার করা হয়েছে।",
      });
    }

    // Step 1: Pre-process with deterministic engine
    const preResult = convertAndRepairBengali(text);
    const initialCandidate = preResult.text;

    const ai = getAIClient();
    const systemInstruction = `You are an expert Bengali linguistic typographer and Unicode normalization specialist.
Task: Convert any Bijoy Classic / SutonnyMJ / ANSI text or repair corrupted Bengali Unicode text (misplaced e-kar, i-kar, split o-kar, broken conjuncts like 'ক ্ত' -> 'ক্ত', 'ব ্যা' -> 'ব্যা').
Rule: Output ONLY the repaired and converted Unicode Bengali text. Never include explanations, pleasantries, or markdown blocks unless the input had code blocks.`;

    const userPrompt = `Input Text:\n"""\n${text}\n"""\n\nCandidate Converted Text:\n"""\n${initialCandidate}\n"""\n\nProvide the perfectly repaired Unicode text:`;

    const { response: aiResponse } = await executeGeminiWithBackoff(
      ai,
      {
        contents: userPrompt,
        config: {
          systemInstruction,
          temperature: 0.1,
        },
      }
    );

    let convertedText = aiResponse.text || "";
    convertedText = convertedText.trim();
    if (convertedText.startsWith("```") && convertedText.endsWith("```")) {
      convertedText = convertedText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
    }

    const charCount = convertedText.length;
    const wordCount = convertedText.trim().split(/\s+/).filter(Boolean).length;

    return res.json({
      convertedText,
      charCount,
      wordCount,
      repaired: true,
      modelUsed: "gemini-ai",
    });
  } catch (error: any) {
    // Smooth deterministic fallback
    try {
      const fallbackResult = convertAndRepairBengali(req.body.text || "");
      return res.json({
        convertedText: fallbackResult.text,
        charCount: fallbackResult.charCount,
        wordCount: fallbackResult.wordCount,
        fallback: true,
        appliedRepairs: fallbackResult.appliedRepairs,
        warning: "অফলাইন রুল-বেসড ইঞ্জিন দিয়ে ব্যাকআপ রূপান্তর সম্পন্ন হয়েছে।",
      });
    } catch (fErr: any) {
      return res.status(500).json({
        error: "রূপান্তরে সমস্যা: " + (fErr?.message || "Internal error"),
      });
    }
  }
});

// AI-powered Scanned Document / PDF Page OCR endpoint
app.post("/api/ocr-page", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg" } = req.body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "imageBase64 is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: "GEMINI_API_KEY is not set in environment." });
    }

    const ai = getAIClient();
    const systemInstruction = `You are a high-precision Bengali OCR engine. Read the Bengali text in the image accurately.
Keep layout, paragraphs, and punctuation intact. Output ONLY the extracted text.`;

    const promptText = `Extract and transcribe all Bengali and English text from this image faithfully:`;

    const { response: aiResponse } = await executeGeminiWithBackoff(
      ai,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
              { text: promptText },
            ],
          },
        ],
        config: {
          systemInstruction,
          temperature: 0.1,
        },
      },
      ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"],
      2
    );

    let extractedText = (aiResponse.text || "").trim();
    if (extractedText.startsWith("```") && extractedText.endsWith("```")) {
      extractedText = extractedText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
    }

    const cleaned = convertAndRepairBengali(extractedText);

    return res.json({
      text: cleaned.text,
      charCount: cleaned.charCount,
      wordCount: cleaned.wordCount,
      appliedRepairs: cleaned.appliedRepairs,
    });
  } catch (error: any) {
    const status = error?.status || error?.code || 500;
    const msg = String(error?.message || "");
    const isQuota = status === 429 || error?.isQuota || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
    const isTransient = isQuota || status === 503 || msg.includes("503") || msg.includes("high demand") || msg.includes("UNAVAILABLE");

    return res.status(isQuota ? 429 : isTransient ? 503 : 500).json({
      error: isQuota
        ? "API রিকুয়েস্ট সীমা শেষ। কিছুক্ষণ পর আবার চেষ্টা করুন।"
        : isTransient
        ? "সার্ভারে চাপ বেশি। কিছুক্ষণ পর আবার চেষ্টা করুন।"
        : "OCR প্রক্রিয়ায় ত্রুটি: " + (error?.message || "OCR error"),
      isTransient,
      isQuota,
    });
  }
});

// Setup Vite middleware for development or static serving for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
