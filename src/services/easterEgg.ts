import { GoogleGenAI, Modality } from "@google/genai";

export async function playEasterEgg() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set, skipping easter egg.');
    return;
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: 'Say in a very sexy, breathy female voice: Happy birthday mister president. Then say normally: Désolé, une petite erreur est survenue. Pourrais-tu réessayer gentiment ?' }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is often used for female voices
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
      await audio.play();
    }
  } catch (error) {
    console.error('Easter egg failed', error);
  }
}
