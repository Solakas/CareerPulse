import { GoogleGenAI, Type } from "@google/genai";
import { Preferences, Profile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeJobPosting(jobText: string, preferences: Preferences, profile: Profile) {
  const model = "gemini-3-flash-preview";

  const prompt = `
    Analyze the following job posting based on the user's career preferences and personal profile.
    
    User Preferences:
    - Company Type: ${preferences.company_type || 'Not specified'}
    - Domain Focus: ${preferences.domain_focus || 'Not specified'}
    - Local Base: ${preferences.local_base || 'Not specified'}
    - Working Model: ${preferences.working_model || 'Not specified'}
    - Local Salary Target: ${preferences.local_salary_target || 'Not specified'}
    - International/Remote Target: ${preferences.int_salary_target || 'Not specified'}
    - Tech/Design Maturity Expectations: ${preferences.tech_maturity || 'Not specified'}
    - Other Preferences: ${preferences.other_preferences || 'None'}

    User Profile (CV & Bio):
    - Bio: ${profile.bio || 'Not specified'}
    - CV Content: ${profile.cv_text || 'Not specified'}
    - Portfolio: ${profile.portfolio_description || 'Not specified'} (${profile.portfolio_link || 'No link'})
    
    Current Remuneration & Benefits:
    - Current Salary: ${profile.currency || ''} ${profile.annual_salary_gross || 'Not specified'} (Gross)
    - Current Benefits Credit: ${profile.benefits_currency || ''} ${profile.annual_credit_net || 'Not specified'} (Net)
    - Other Benefits: ${profile.rest_benefits || 'None'}

    Job Posting:
    ${jobText}

    Provide a detailed review in the 'analysis' field which is an array of objects.
    Each object should have a 'title' (text only, no emojis), 'content' (markdown), and a relevant 'icon' (emoji).
    
    Sections to include (use these as titles but without the emojis):
    1. Company & Stability
    2. Product Type & Complexity
    3. Role & Seniority Fit (Personalized based on User Profile)
    4. Design System Match
    5. Salary & Equity Realism
    6. Risk/Position Evaluation (A detailed comparison between the user's current remuneration & benefits vs the estimated package of the new job. Evaluate if the move is financially and professionally worth the risk.)
    7. Pros & Cons
    
    Also provide a 'verdict' (Apply/Skip/Research), a 'score' (0-100), 'salary_info' (e.g. "€60k-€80k (Realistic)" or "Not listed"), and 'seniority_level' (e.g. "Senior (5+ yrs)", "Lead (8+ yrs)").
    
    Use Google Search to verify company reputation or salary benchmarks if needed.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          job_title: { type: Type.STRING },
          company_name: { type: Type.STRING },
          score: { type: Type.INTEGER },
          salary_info: { type: Type.STRING },
          seniority_level: { type: Type.STRING },
          analysis: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                icon: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          },
          verdict: { type: Type.STRING }
        },
        required: ["job_title", "company_name", "score", "analysis", "verdict", "salary_info", "seniority_level"]
      }
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function analyzeCV(base64Data: string, mimeType: string) {
  const model = "gemini-3.1-pro-preview";
  const prompt = "Extract all text and key information from this CV/Resume. Provide a comprehensive summary of experience, skills, and education in a clean format that can be used as a profile description for job matching.";

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Data.split(',')[1], mimeType } },
        { text: prompt }
      ]
    }
  });

  return response.text;
}

export async function analyzeJobImage(base64Image: string, preferences: Preferences, profile: Profile) {
  const model = "gemini-3.1-pro-preview";

  const prompt = `
    Extract the job posting details from this image and analyze it based on the user's career preferences and personal profile.
    
    User Preferences:
    - Company Type: ${preferences.company_type || 'Not specified'}
    - Domain Focus: ${preferences.domain_focus || 'Not specified'}
    - Local Base: ${preferences.local_base || 'Not specified'}
    - Working Model: ${preferences.working_model || 'Not specified'}
    - Local Salary Target: ${preferences.local_salary_target || 'Not specified'}
    - International/Remote Target: ${preferences.int_salary_target || 'Not specified'}
    - Tech/Design Maturity Expectations: ${preferences.tech_maturity || 'Not specified'}
    - Other Preferences: ${preferences.other_preferences || 'None'}

    User Profile (CV & Bio):
    - Bio: ${profile.bio || 'Not specified'}
    - CV Content: ${profile.cv_text || 'Not specified'}
    - Portfolio: ${profile.portfolio_description || 'Not specified'} (${profile.portfolio_link || 'No link'})
    
    Current Remuneration & Benefits:
    - Current Salary: ${profile.currency || ''} ${profile.annual_salary_gross || 'Not specified'} (Gross)
    - Current Benefits Credit: ${profile.benefits_currency || ''} ${profile.annual_credit_net || 'Not specified'} (Net)
    - Other Benefits: ${profile.rest_benefits || 'None'}

    Provide a detailed review in the 'analysis' field which is an array of objects.
    Each object should have a 'title' (text only, no emojis), 'content' (markdown), and a relevant 'icon' (emoji).
    
    Sections to include (use these as titles but without the emojis):
    1. Company & Stability
    2. Product Type & Complexity
    3. Role & Seniority Fit (Personalized based on User Profile)
    4. Design System Match
    5. Salary & Equity Realism
    6. Risk/Position Evaluation (A detailed comparison between the user's current remuneration & benefits vs the estimated package of the new job. Evaluate if the move is financially and professionally worth the risk.)
    7. Pros & Cons
    
    Also provide a 'verdict' (Apply/Skip/Research), a 'score' (0-100), 'salary_info' (e.g. "€60k-€80k (Realistic)" or "Not listed"), and 'seniority_level' (e.g. "Senior (5+ yrs)", "Lead (8+ yrs)").
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType: "image/png" } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          job_title: { type: Type.STRING },
          company_name: { type: Type.STRING },
          score: { type: Type.INTEGER },
          salary_info: { type: Type.STRING },
          seniority_level: { type: Type.STRING },
          analysis: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                icon: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          },
          verdict: { type: Type.STRING }
        },
        required: ["job_title", "company_name", "score", "analysis", "verdict", "salary_info", "seniority_level"]
      }
    },
  });

  return JSON.parse(response.text || "{}");
}
