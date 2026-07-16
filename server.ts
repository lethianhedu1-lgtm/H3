import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header as required by the skill
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API endpoint for health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Real subtitle translation proxy using Gemini 3.5 Flash
app.post("/api/translate", async (req, res) => {
  try {
    const { subtitles, sourceLang, targetLang } = req.body;

    if (!subtitles || !Array.isArray(subtitles)) {
      return res.status(400).json({ error: "Invalid subtitles format. Expected an array." });
    }

    if (!targetLang) {
      return res.status(400).json({ error: "Target language is required." });
    }

    const sourceText = subtitles.map(s => `[${s.id}] ${s.text}`).join("\n");

    const prompt = `Translate the following video subtitles from ${sourceLang || "detected language"} to ${targetLang}. 
Maintain the same IDs so they map back to the original timestamps. 
Make the translations natural, matching the style of spoken dialog (dubbing/voiceover) for that language. Ensure the length of the sentences is appropriate for dubbing.

Subtitles to translate:
${sourceText}`;

    // Call Gemini with schema-based JSON output to guarantee correct response structure
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are an expert audio dubbing translator. You translate subtitles accurately while keeping them natural and paced correctly for spoken voiceovers.",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.INTEGER,
                description: "The unique ID of the subtitle item as received."
              },
              translatedText: {
                type: Type.STRING,
                description: "The translated speech text in the target language."
              }
            },
            required: ["id", "translatedText"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response received from Gemini.");
    }

    const translations = JSON.parse(text.trim());
    
    // Map translated text back to the original timestamps
    const translatedSubtitles = subtitles.map(original => {
      const translation = translations.find((t: any) => t.id === original.id);
      return {
        ...original,
        text: translation ? translation.translatedText : original.text,
        originalText: original.text
      };
    });

    res.json({ success: true, subtitles: translatedSubtitles });
  } catch (error: any) {
    console.error("Gemini Translation Error:", error);
    res.status(500).json({ error: error.message || "Internal Translation Error" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite HMR middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Dubbing Studio server is running on http://localhost:${PORT}`);
  });
}

startServer();
