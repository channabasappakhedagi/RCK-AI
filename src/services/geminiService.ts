import { GoogleGenAI, Modality, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  isAI: boolean;
  confidence: number;
  reasoning: string;
  threatLevel: 'low' | 'medium' | 'high';
  transcription?: string;
}

export interface ResolutionStep {
  step: string;
  priority: 'low' | 'medium' | 'high';
  link?: string;
}

export interface WebSearchThreat {
  url: string;
  title: string;
  description: string;
  threatType: 'impersonation' | 'deepfake' | 'unauthorized_use' | 'safe';
  riskScore: number;
  confidenceScore: number;
  resolutionPlan: ResolutionStep[];
  evidence: string;
}

export const geminiService = {
  async analyzeMedia(base64Data: string, mimeType: string, options?: { modelType?: 'image' | 'video' | 'audio' | 'auto', sensitivity?: 'low' | 'medium' | 'high' }): Promise<AnalysisResult> {
    const isAudio = mimeType.startsWith('audio/') || options?.modelType === 'audio';
    const model = "gemini-3.1-pro-preview";
    const sensitivity = options?.sensitivity || 'medium';
    
    const sensitivityPrompt = sensitivity === 'high' 
      ? "Be extremely critical and flag even the slightest inconsistencies as potential AI generation."
      : sensitivity === 'low'
      ? "Only flag media as AI-generated if there is strong, undeniable evidence of synthetic patterns."
      : "Use standard detection thresholds to balance accuracy and false positives.";

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: `Analyze this ${isAudio ? 'audio' : 'media'} for signs of AI generation, deepfake manipulation, or synthetic voice cloning. ${isAudio ? 'Also provide a transcription of the audio content.' : ''} 
            
            Detection Sensitivity: ${sensitivity.toUpperCase()}.
            ${sensitivityPrompt}
            
            Provide a JSON response with: isAI (boolean), confidence (0-1), reasoning (string), threatLevel ('low', 'medium', 'high')${isAudio ? ', and transcription (string)' : ''}.`,
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isAI: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            threatLevel: { type: Type.STRING },
            transcription: { type: Type.STRING },
          },
          required: ["isAI", "confidence", "reasoning", "threatLevel"],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  },

  async searchIdentityMisuse(name: string, context: string): Promise<WebSearchThreat[]> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a highly accurate web crawl and search for potential misuse of the identity of "${name}". 
      Context: ${context}. 
      
      CRITICAL ACCURACY & DETECTION GUIDELINES:
      - PRIORITIZE detecting impersonation attempts that use AI-generated profile pictures (e.g., GAN-generated faces, stable diffusion artifacts) and synthetic bios.
      - Distinguish between legitimate mentions (e.g., official profiles, news articles, professional citations) and illegitimate misuse.
      - Focus on impersonation, deepfakes, unauthorized commercial use, and presence on malicious domains.
      - If a result is likely legitimate, do not include it or mark it as 'safe' with a low risk score.
      
      For each potential threat found, provide:
      - url: The source URL.
      - title: A descriptive title.
      - description: A detailed summary of why this is considered a threat.
      - threatType: One of 'impersonation', 'deepfake', 'unauthorized_use', or 'safe'.
      - riskScore: A score from 0 to 100 representing the severity.
      - confidenceScore: A score from 0 to 100 representing our certainty that this is indeed a misuse.
      - resolutionPlan: A granular list of steps to address the threat. Each step should have a 'step' description, a 'priority' ('low', 'medium', 'high'), and an optional 'link' to a reporting tool or resource.
      - evidence: Specific details found (e.g., "Mismatched location in bio", "AI artifacts in profile picture").`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              url: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              threatType: { type: Type.STRING },
              riskScore: { type: Type.NUMBER },
              confidenceScore: { type: Type.NUMBER },
              resolutionPlan: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    step: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    link: { type: Type.STRING },
                  },
                  required: ["step", "priority"],
                }
              },
              evidence: { type: Type.STRING },
            },
            required: ["url", "title", "description", "threatType", "riskScore", "confidenceScore", "resolutionPlan", "evidence"],
          },
        },
      },
    });

    return JSON.parse(response.text || "[]");
  },

  async chat(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[], systemInstruction?: string) {
    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: {
        systemInstruction: systemInstruction || "You are RCK ai, a world-class cybersecurity assistant specializing in identity protection, deepfake detection, and AI threat mitigation. Help users understand how to protect their images, videos, and personal space from AI-driven threats.",
      },
      history: history,
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  }
};
