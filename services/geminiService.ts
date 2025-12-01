
import { GoogleGenAI } from "@google/genai";
import { ResearchResult, Source, ResearchTask } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Researches a specific query for a given entity using Google Search Grounding.
 */
export const researchEntity = async (
  entityName: string, 
  userQuery: string, 
  context?: string,
  useThinkingModel: boolean = false
): Promise<ResearchResult> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure process.env.API_KEY.");
  }

  // Select model based on thinking mode preference
  // gemini-3-pro-preview supports thinkingConfig
  const model = useThinkingModel ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
  
  // Construct a prompt that encourages concise answers suitable for a CSV cell
  const prompt = `
    I have a list of items (companies, people, or URLs) in a CSV file. 
    I need you to perform a specific research task for one row.
    
    Subject / Entity: "${entityName}"
    ${context ? `Additional Context from other columns: ${context}` : ''}
    
    Task: ${userQuery}
    
    Rules:
    1. Use the Google Search tool to find the most current information.
    2. URL HANDLING: If the "Subject" is a URL, or if a specific URL (like a LinkedIn profile or website) is provided in the "Additional Context", use Google Search to find content specifically associated with that page.
    3. If the task asks for a specific fact (e.g. "CEO Name", "Revenue", "Website"), return ONLY the value. No sentences.
    4. If the task asks for a description, summary, or bio, provide a concise paragraph (max 2-3 sentences).
    5. If the requested value is a URL, return the full valid URL (starting with http/https).
    6. If the information is not found after searching, return "N/A".
    7. LOGIN WALLS / RATE LIMITS: If a specific URL (especially LinkedIn, Facebook, Instagram) is blocked, requires a login, or returns a rate limit error, DO NOT give up. You MUST use the information available in the Google Search Snippets, Titles, and Metadata to answer the question. The search result summaries often contain the bio, current role, or company info needed.
  `;

  try {
    // Configure based on model capabilities
    const config: any = {
      tools: [{ googleSearch: {} }], // Enable live internet access
    };

    if (useThinkingModel) {
      // High thinking budget for complex reasoning
      config.thinkingConfig = { thinkingBudget: 32768 };
    } else {
      // Standard configuration for Flash
      config.temperature = 0.1; 
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const text = response.text ? response.text.trim() : "N/A";
    
    // Extract sources from grounding metadata
    const sources: Source[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach(chunk => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title ?? 'Source',
            uri: chunk.web.uri ?? ''
          });
        }
      });
    }

    return { text, sources };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return { text: "Error", sources: [] };
  }
};

/**
 * Generates a list of research tasks and selects target columns based on a natural language request.
 */
export const generateResearchConfig = async (
  userRequest: string,
  availableColumns: string[],
  useProModel: boolean = false
): Promise<{ tasks: Omit<ResearchTask, 'id'>[], targetColumns: string[] }> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  // Use Gemini 3 Pro (mapped from "Pro" request) for complex reasoning or Gemini 2.5 Flash for speed
  const model = useProModel ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';

  const prompt = `
    You are a data enrichment assistant.
    The user has a CSV with these columns: ${JSON.stringify(availableColumns)}.
    
    User Request: "${userRequest}"
    
    Goal: Configure a research agent to fulfill the user request.

    1. Select input columns: Identify which specific columns from the provided list are best used to identify the subject (e.g. "Company", "URL", "Name", "Email"). Return these as 'targetColumns'.
    2. Create tasks: Generate a list of new columns to add, with specific prompts for the AI to find that information using Google Search.
    
    Return ONLY raw JSON (no markdown formatting) in this structure:
    {
      "targetColumns": ["Existing Column Name 1", "Existing Column Name 2"], 
      "tasks": [
        {
          "newColumnName": "Short Column Name",
          "prompt": "Specific instruction to find the value..."
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '{}';
    const result = JSON.parse(text);
    
    return {
      tasks: result.tasks || [],
      targetColumns: result.targetColumns || []
    };
  } catch (error) {
    console.error("Plan generation failed:", error);
    return { tasks: [], targetColumns: [] };
  }
};
