import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Helper to check if API key exists to avoid runtime crashes in UI
export const hasApiKey = !!apiKey;

export const analyzeDiet = async (mealDescription: string, imageBase64?: string): Promise<{ calories: number; advice: string }> => {
  if (!hasApiKey) {
    return {
      calories: 0,
      advice: "API Key가 설정되지 않았습니다. .env를 확인해주세요."
    };
  }

  try {
    const promptText = `
      Analyze the following meal for an acting student who needs to maintain energy and vocal health.
      Meal Description: "${mealDescription}"
      ${imageBase64 ? "An image of the meal is also provided." : ""}
      
      Return a JSON object with:
      - "calories": estimated integer number (if image is provided, estimate based on portion size in image)
      - "advice": A short, encouraging tip in Korean (max 2 sentences) focusing on nutritional balance for actors.
    `;

    const parts: any[] = [{ text: promptText }];

    if (imageBase64) {
      // Extract base64 data and mime type
      // format: "data:image/jpeg;base64,/9j/4AAQ..."
      const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Diet Analysis Error:", error);
    return {
      calories: 0,
      advice: "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
    };
  }
};

export const analyzeMonologue = async (text: string): Promise<string> => {
  if (!hasApiKey) {
    return "API Key가 필요합니다.";
  }

  try {
    const prompt = `
      You are an expert acting coach. Analyze the following short monologue or script segment submitted by a student.
      Script: "${text}"

      Provide feedback in Korean covering:
      1. Emotional subtext (감정선)
      2. Suggested pacing or tone (호흡 및 어조)
      3. A constructive tip for improvement.
      
      Keep the tone encouraging, professional, and warm. Max 200 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "분석 결과를 가져올 수 없습니다.";
  } catch (error) {
    console.error("Monologue Analysis Error:", error);
    return "AI 분석 중 오류가 발생했습니다.";
  }
};

export const askAiTutor = async (question: string): Promise<string> => {
  if (!hasApiKey) {
    return "API Key 설정이 필요합니다.";
  }

  try {
    const prompt = `
      You are a friendly and knowledgeable acting teacher (Mentor) at an acting academy.
      A student has asked the following question:
      "${question}"

      Please provide a helpful, encouraging, and practical answer in Korean.
      If the question is about acting techniques, give specific examples.
      If it's about career or anxiety, be supportive.
      Keep the answer concise (under 300 characters if possible) but informative.
      Tone: Warm, Professional, Mentor-like.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "답변을 생성할 수 없습니다.";
  } catch (error) {
    console.error("AI Tutor Error:", error);
    return "AI 튜터 연결에 실패했습니다.";
  }
};