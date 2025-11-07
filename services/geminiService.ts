// This file interacts with the Google Gemini API.
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// This function gets a sales forecast.
export const getSalesForecast = async (): Promise<string> => {
  console.log("Calling Gemini API for sales forecast...");
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: `Based on historical sales data, current trends, and upcoming holidays, provide a sales forecast for the next 7 days. Present it as a brief, actionable summary.`,
    });
    return response.text;
  } catch (error) {
    console.error("Error fetching sales forecast:", error);
    return "Could not fetch sales forecast due to an API error.";
  }
};

// This function predicts low stock items.
export const getLowStockPrediction = async (): Promise<string> => {
  console.log("Calling Gemini API for low stock prediction...");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the following inventory data and sales velocity: [YOUR_INVENTORY_JSON]. Predict which 3 items are most likely to run out of stock by Friday.`,
    });
    return response.text;
  } catch (error) {
    console.error("Error fetching low stock prediction:", error);
    return "Could not fetch low stock prediction due to an API error.";
  }
};

// This function gets customer cross-sell recommendations.
export const getCustomerRecommendations = async (purchaseHistory: string): Promise<string> => {
    console.log("Calling Gemini API for customer recommendations...");
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `A customer just added these items to their cart: ${purchaseHistory}. Based on common purchasing patterns, suggest two relevant cross-sell items.`,
        });
        return response.text;
    } catch (error) {
        console.error("Error fetching customer recommendations:", error);
        return "Could not fetch recommendations due to an API error.";
    }
};

// This function gets an AI-suggested category for a product.
export const getAIcategory = async (productName: string): Promise<string> => {
  console.log("Calling Gemini API for AI category...");
  if (!productName) return "Uncategorized";
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the product name "${productName}", suggest a single, concise retail category for it (e.g., "Dairy", "Bakery", "Beverages", "Produce"). Return only the category name.`,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error fetching AI category:", error);
    return "Error";
  }
};