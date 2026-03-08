import { GoogleGenAI, Modality, Type } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import languagesData from "../data/languages.json";
import voicePreviewsData from "../data/voicePreviews.json";

export const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;
export type VoiceName = typeof VOICES[number];

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export interface ScriptSegment {
  text: string;
  visualPrompt: string;
}

export interface GeneratedScript {
  title: string;
  caption: string;
  tags: string[];
  segments: ScriptSegment[];
}

export class AIService {
  private gemini: GoogleGenAI | null = null;
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private openrouter: OpenAI | null = null;
  
  private provider: AIProvider;
  private scriptModel: string;
  private imageModel: string;
  private apiKey: string;

  constructor(
    apiKey: string, 
    provider: AIProvider = 'gemini',
    scriptModel: string = "gemini-3-flash-preview", 
    imageModel: string = "gemini-2.5-flash-image"
  ) {
    this.apiKey = apiKey;
    this.provider = provider;
    this.scriptModel = scriptModel;
    this.imageModel = imageModel;

    if (provider === 'gemini') {
      this.gemini = new GoogleGenAI({ apiKey });
    } else if (provider === 'openai') {
      this.openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    } else if (provider === 'anthropic') {
      this.anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    } else if (provider === 'openrouter') {
      this.openrouter = new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
          "HTTP-Referer": window.location.origin,
          "X-Title": "ShortsAI Pro",
        }
      });
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 3000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const is429 = error?.status === 429 || 
                    error?.message?.includes("429") || 
                    error?.message?.includes("RESOURCE_EXHAUSTED") ||
                    error?.response?.status === 429 ||
                    error?.message?.includes("Quota exceeded");

      if (is429 && retries > 0) {
        console.warn(`Rate limited (429). Retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(fn, retries - 1, delay * 1.5);
      }

      if (is429) {
        throw new Error("API Quota Exceeded (429). This usually happens when the shared key is overused. Please provide your own Gemini API key in Settings to bypass this.");
      }

      throw error;
    }
  }

  async generateScript(niche: string, language: string = "English"): Promise<GeneratedScript> {
    // Validate language
    if (!this.isLanguageSupported(language)) {
      throw new Error(`Selected language "${language}" is not in our supported list. Please choose a common language.`);
    }

    const prompt = `Generate a high-engagement YouTube Short script for the niche: "${niche}". 
    The script MUST be written in the following language: ${language}.
    The script MUST be between 15 and 20 seconds long.
    
    CRITICAL INSTRUCTION: 
    1. The first segment MUST be a catchy introduction where the narrator introduces the topic (e.g., "Welcome to our look at ${niche}").
    2. The entire script must be naturally translated and localized for ${language} speakers.
    3. Ensure the tone is appropriate for the niche and the language.
    
    Break it down into exactly 4-5 distinct segments. 
    For each segment, provide the spoken text (about 3-4 seconds worth) and a detailed visual prompt for an AI image generator.
    Also provide a catchy YouTube Short title/caption and 5 relevant hashtags.
    Return the result in JSON format with this structure:
    {
      "title": "string",
      "caption": "string",
      "tags": ["string"],
      "segments": [{"text": "string", "visualPrompt": "string"}]
    }`;

    if (this.provider === 'gemini' && this.gemini) {
      return this.withRetry(async () => {
        const response = await this.gemini!.models.generateContent({
          model: this.scriptModel,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                caption: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                segments: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      visualPrompt: { type: Type.STRING }
                    },
                    required: ["text", "visualPrompt"]
                  }
                }
              },
              required: ["title", "caption", "tags", "segments"]
            }
          }
        });
        return JSON.parse(response.text || "{}");
      });
    } 
    
    if ((this.provider === 'openai' && this.openai) || (this.provider === 'openrouter' && this.openrouter)) {
      const client = this.provider === 'openai' ? this.openai! : this.openrouter!;
      const response = await client.chat.completions.create({
        model: this.scriptModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: this.provider === 'openai' ? { type: 'json_object' } : undefined
      });
      const content = response.choices[0].message.content || "{}";
      // OpenRouter might not support response_format: json_object for all models, so we try to parse
      try {
        return JSON.parse(content);
      } catch (e) {
        // Fallback: try to extract JSON from text if model didn't return pure JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
      }
    }

    if (this.provider === 'anthropic' && this.anthropic) {
      const response = await this.anthropic.messages.create({
        model: this.scriptModel,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt + "\n\nIMPORTANT: Return ONLY the JSON object." }]
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return JSON.parse(text || "{}");
    }

    throw new Error("Provider not configured correctly");
  }

  public checkLanguageAvailability(language: string): string {
    if (this.isLanguageSupported(language)) {
      return `Selected language "${language}" is available. Narrator is ready.`;
    }
    throw new Error(`Selected language "${language}" is not currently supported.`);
  }

  private isLanguageSupported(language: string): boolean {
    const normalized = language.trim().toLowerCase();
    return languagesData.languages.some(l => l.toLowerCase() === normalized);
  }

  async generateVoiceover(text: string, voice: VoiceName = 'Kore', language: string = 'English'): Promise<string> {
    // We'll stick to Gemini for TTS as it's built-in to the SDK we're using for audio
    // If the user is using OpenAI/Anthropic for script, we still need a Gemini key for TTS
    // Or we could try OpenAI TTS if they have an OpenAI key.
    
    if (this.provider === 'openai' && this.openai) {
      const mp3 = await this.openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      return `data:audio/mp3;base64,${buffer.toString('base64')}`;
    }

    // Use provided key if available, otherwise fallback to environment key
    const ttsKey = this.apiKey || process.env.GEMINI_API_KEY || "";
    if (!ttsKey) throw new Error("Gemini API Key is required for voice generation. Please add it in settings.");
    
    const ttsAi = new GoogleGenAI({ apiKey: ttsKey });
    
    // The text is already in the target language from generateScript
    // We pass it directly to the TTS model with an explicit command
    if (!text || text.trim().length === 0) {
      throw new Error("No text provided for voiceover generation.");
    }
    
    const ttsPrompt = `Speak naturally in ${language}: ${text}`;

    const response = await this.withRetry(() => ttsAi.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    }));

    // Find the audio part in the response
    let base64Audio: string | undefined;
    const candidate = response.candidates?.[0];
    
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          base64Audio = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Audio) {
      const finishReason = candidate?.finishReason;
      const safetyRatings = candidate?.safetyRatings;
      let textResponse = "";
      try {
        textResponse = response.text || "";
      } catch (e) {
        // No text part
      }
      
      console.error("TTS Response missing audio:", { finishReason, safetyRatings, textResponse, response });
      
      if (finishReason === 'SAFETY') {
        throw new Error("Voiceover generation was blocked by safety filters. Try a different niche or prompt.");
      }
      if (textResponse) {
        throw new Error(`Failed to generate voiceover: ${textResponse}`);
      }
      throw new Error("Failed to generate voiceover. The model did not return audio data.");
    }
    
    return this.wrapPcmInWav(base64Audio, 24000);
  }

  private wrapPcmInWav(base64Pcm: string, sampleRate: number): string {
    const pcmData = Uint8Array.from(atob(base64Pcm), c => c.charCodeAt(0));
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    view.setUint32(0, 0x52494646, false); 
    view.setUint32(4, 36 + pcmData.length, true); 
    view.setUint32(8, 0x57415645, false); 
    view.setUint32(12, 0x666d7420, false); 
    view.setUint32(16, 16, true); 
    view.setUint16(20, 1, true); 
    view.setUint16(22, 1, true); 
    view.setUint32(24, sampleRate, true); 
    view.setUint32(28, sampleRate * 2, true); 
    view.setUint16(32, 2, true); 
    view.setUint16(34, 16, true); 
    view.setUint32(36, 0x64617461, false); 
    view.setUint32(40, pcmData.length, true); 

    const combined = new Uint8Array(wavHeader.byteLength + pcmData.length);
    combined.set(new Uint8Array(wavHeader), 0);
    combined.set(pcmData, wavHeader.byteLength);
    
    const binary = Array.from(combined).map(b => String.fromCharCode(b)).join('');
    return `data:audio/wav;base64,${btoa(binary)}`;
  }

  async generateVisual(prompt: string): Promise<string> {
    if ((this.provider === 'openai' && this.openai) || (this.provider === 'openrouter' && this.openrouter)) {
      const client = this.provider === 'openai' ? this.openai! : this.openrouter!;
      const response = await client.images.generate({
        model: this.imageModel || "dall-e-3",
        prompt: `A high-quality cinematic 9:16 vertical image for a YouTube Short. Subject: ${prompt}. Style: Professional, vibrant, detailed.`,
        n: 1,
        size: "1024x1792",
        response_format: "b64_json"
      });
      return `data:image/png;base64,${response.data[0].b64_json}`;
    }

    if (this.provider === 'gemini' && this.gemini) {
      return this.withRetry(async () => {
        try {
          const response = await this.gemini!.models.generateContent({
            model: this.imageModel,
            contents: {
              parts: [
                {
                  text: `A high-quality cinematic 9:16 vertical image for a YouTube Short. Subject: ${prompt}. Style: Professional, vibrant, detailed.`,
                },
              ],
            },
            config: {
              imageConfig: {
                aspectRatio: "9:16",
              },
            },
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              return `data:image/png;base64,${part.inlineData.data}`;
            }
          }
          throw new Error("No image data returned from Gemini");
        } catch (error: any) {
          console.error("Gemini Image Error:", error);
          if (error?.message?.includes("not found") || error?.message?.includes("404")) {
            throw new Error(`Image model "${this.imageModel}" not found. Your API key might not have access to image generation yet, or this model is restricted in your region/tier.`);
          }
          if (error?.message?.includes("permission") || error?.message?.includes("403")) {
            throw new Error("Permission denied for image generation. Ensure your API key has the necessary permissions for 'gemini-2.5-flash-image'.");
          }
          throw error;
        }
      });
    }

    throw new Error("Image generation failed or provider not supported for images");
  }

  async generateVoicePreview(voice: VoiceName, language: string = 'English'): Promise<string> {
    // Smart move: Check pre-generated data first
    const cacheKey = `voice_preview_${voice}_${language}`;
    if ((voicePreviewsData as any)[cacheKey]) {
      return (voicePreviewsData as any)[cacheKey];
    }

    // Then check localStorage
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    const text = language === 'English' 
      ? `Hello, I am ${voice}. I will be your narrator for this short.`
      : `Hello, I am ${voice}. I will be your narrator for this short. Speaking in ${language}.`;
    
    const audio = await this.generateVoiceover(text, voice, language);
    
    // Save to cache
    try {
      localStorage.setItem(cacheKey, audio);
    } catch (e) {
      console.warn("Failed to cache voice preview", e);
    }
    
    return audio;
  }
}
