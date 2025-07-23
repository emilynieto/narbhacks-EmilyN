import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
);

export async function generateTravelRecommendations(
  location: string,
  preferences: string,
) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are a concise travel assistant. Provide brief travel recommendations for ${location} based on: ${preferences}. 
  - List 2-3 specific places 
  - Use 1 short sentence per place
  - Be direct and skip unnecessary details`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

export async function answerTravelQuestion(location: string, question: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `As a travel expert for ${location}, answer this question concisely: ${question}
  - Be direct and to the point
  - Provide only essential information
  - If more details would be helpful, end with "Ask me for more details if needed."`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}
