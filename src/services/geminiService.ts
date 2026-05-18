import { AnalysisResponse } from '../types';

export const analyzeForexChart = async (
  imageBase64: string,
  userNotes?: string,
  preferredMode?: 'Técnico' | 'Fundamental' | 'Híbrido',
  userPlan?: string
): Promise<AnalysisResponse> => {

  const response = await fetch(
    'https://quantscan-backend.onrender.com/api/analyze',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        imageBase64,
        userNotes,
        preferredMode,
        userPlan
      }),
    }
  );

  if (!response.ok) {

    const errorData =
      await response.json().catch(() => ({}));

    throw new Error(
      errorData.error ||
      `HTTP error! status: ${response.status}`
    );

  }

  return await response.json() as AnalysisResponse;
};