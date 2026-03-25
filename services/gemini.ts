// Gemini API calls are now handled by backend endpoints:
//   POST /api/diet/analyze       → analyzeDiet
//   POST /api/assignments/:id/analyze → analyzeMonologue
//   POST /api/qna/:id/ai-answer  → askAiTutor
//
// This file is kept as a stub to avoid import errors.
// Frontend should use services/api.ts endpoints instead.

export const hasApiKey = false;

export const analyzeDiet = async (_mealDescription: string, _imageBase64?: string): Promise<{ calories: number; advice: string }> => {
  return { calories: 0, advice: "백엔드 API를 사용해주세요." };
};

export const analyzeMonologue = async (_text: string): Promise<string> => {
  return "백엔드 API를 사용해주세요.";
};

export const askAiTutor = async (_question: string): Promise<string> => {
  return "백엔드 API를 사용해주세요.";
};
