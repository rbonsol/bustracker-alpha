import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateAnnouncement = async (situation: string, context: { speed: number, location: string }): Promise<string> => {
  try {
    const client = getAiClient();
    const prompt = `
      You are an AI assistant for a professional bus driver.
      The driver is currently facing the following situation: "${situation}".
      Current context - Speed: ${context.speed.toFixed(1)} km/h. Coordinates: ${context.location}.

      Write a short, polite, and reassuring announcement message (max 2 sentences) that the driver can broadcast to the passengers or send to the dispatch center.
      Tone: Professional, calm, and informative.
    `;

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || "Unable to generate announcement.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating announcement. Please check your connection.";
  }
};
