import { GoogleGenAI } from '@google/genai';
import { MemoryItem } from '../types';
import { addMemory, fetchMemories } from './memoryService';

/**
 * Interface representing and matching the extraction schema
 */
export interface ExtractedMemory {
  content: string;
  category: 'preference' | 'episodic' | 'semantic' | 'project' | 'task';
  importance: number;
  tags: string[];
}

/**
 * Automates memory extraction from a given user message and/or model response.
 * Runs asynchronously to extract and save relevant preferences, general knowledge, actions or facts.
 */
export async function extractAndStoreMemories(
  apiKey: string,
  uid: string,
  userMessage: string,
  modelResponse?: string
): Promise<MemoryItem[]> {
  if (!apiKey || !userMessage.trim()) return [];

  const ai = new GoogleGenAI({ apiKey });
  const contextText = `User Message: "${userMessage}"${modelResponse ? `\nMhiee's Response: "${modelResponse}"` : ''}`;

  const prompt = `You are Mhiee's Cognitive Extraction Subsystem (v3.1).
Analyze the following conversation sample and extract any memorable fragments.
We are looking for:
1. 'preference': Favorite tools, languages (like Hausa), hobbies, preferences, custom names.
2. 'episodic': Key events, mecha tests, date milestones, special conversation points.
3. 'semantic': Core facts, tech rules, physics equations, coding patterns, ADUSTECH details.
4. 'project': Information on assignments, projects (like 'Project BACH'), mechatronic systems.
5. 'task': Specific items accomplished, goals set, plans, status updates.

If nothing highly memorable, vital, or structurally useful is found, return ONLY an empty array: [].
Do NOT capture trivial chat fillers, greetings, generic replies, or fleeting thoughts.
Be selective. Assign an importance score from 1 (lowest) to 10 (highest). Create 1-3 useful lowercase tags.

IMPORTANT: You MUST respond ONLY with a raw, valid JSON array. Do not put markdown blocks, backticks, or other text outside the array.

Example output:
[
  {
    "content": "User's favorite programming language is Hausa.",
    "category": "preference",
    "importance": 9,
    "tags": ["hausa", "language"]
  }
]

Now, parse and extract from this dialogue:
${contextText}`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const textOutput = (result.text || '').trim();
    if (!textOutput || textOutput === '[]') return [];

    const parsed: ExtractedMemory[] = JSON.parse(textOutput);
    const added: MemoryItem[] = [];

    for (const item of parsed) {
      if (!item.content || !item.category) continue;
      
      // Limit importance limits to 1-10
      const importanceValue = Math.min(10, Math.max(1, Number(item.importance) || 5));
      
      // Save to Firebase using the existing memoryService
      const newMemory = await addMemory(
        uid,
        item.content,
        item.category,
        importanceValue,
        item.tags || []
      );
      
      if (newMemory) {
        added.push(newMemory);
      }
    }

    return added;
  } catch (error) {
    console.warn('Failed to auto-extract memories (API Key/Permission issue).');
    return [];
  }
}

/**
 * Rank a list of memories deterministically against a search query
 * Scoring components:
 * 1. Keyword overlap (Relevance) - Weight: 60%
 * 2. Importance Score (Priority) - Weight: 25%
 * 3. Timestamp recency (Recency) - Weight: 15%
 */
export function rankMemories(
  memories: MemoryItem[],
  queryText: string,
  limit = 5
): Array<{ memory: MemoryItem; score: number }> {
  if (!memories || memories.length === 0) return [];
  
  const now = Date.now();
  const query = queryText.toLowerCase().trim();
  
  if (!query) {
    // If no query, rank purely by Importance + Recency
    return memories
      .map(mem => {
        const timeDiffWeeks = (now - mem.createdAt) / (1000 * 60 * 60 * 24 * 7);
        const recencyScore = Math.max(0, 1 - timeDiffWeeks / 4); // decays over 4 weeks
        const score = (mem.importance / 10) * 0.7 + recencyScore * 0.3;
        return { memory: mem, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Pre-process search query terms
  const terms = query
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length >= 2); // ignore single letter noise

  const scored = memories.map(mem => {
    let relevanceScore = 0;
    const contentLower = mem.content.toLowerCase();
    const categoryLower = mem.category.toLowerCase();
    const tagsLower = (mem.tags || []).map(t => t.toLowerCase());

    // Compute keyword matching
    for (const term of terms) {
      // Direct word matches
      if (contentLower.includes(term)) {
        relevanceScore += 2.0;
        // Exact boundary match bonus
        if (new RegExp(`\\b${term}\\b`).test(contentLower)) {
          relevanceScore += 1.0;
        }
      }
      
      // Category matches
      if (categoryLower.includes(term)) {
        relevanceScore += 1.5;
      }
      
      // Tag matches
      if (tagsLower.some(tag => tag.includes(term))) {
        relevanceScore += 2.0;
        if (tagsLower.includes(term)) {
          relevanceScore += 1.0;
        }
      }
    }

    // Normalize relevance based on length/terms count
    const normalizedRelevance = terms.length > 0 ? Math.min(10, relevanceScore / terms.length) : 0;
    const normalizedImportance = mem.importance / 10; // 0 to 1

    // Temporal decay score (1.0 = brand new, decays towards 0)
    const weeksScale = 1000 * 60 * 60 * 24 * 7 * 4; // 4 weeks scale
    const recencyScore = Math.max(0, 1 - (now - mem.createdAt) / weeksScale);

    // Final Weighted Calculation
    const score = (normalizedRelevance * 0.6) + (normalizedImportance * 0.25) + (recencyScore * 0.15);

    return { memory: mem, score };
  });

  // Filter out completely irrelevant ones if query was provided, but ensure some high-importance items can bubble up if relevant
  return scored
    .filter(item => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Summarizes the entire memory collection of a user into an elegant narrative (Mhiee's Cognitive Profile).
 */
export async function summarizeMemories(apiKey: string, uid: string): Promise<string> {
  if (!apiKey) return 'Ayyah, memory authorization is required to summarize the vault. 🥺';
  
  try {
    const memories = await fetchMemories(uid);
    if (!memories || memories.length === 0) {
      return '';
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Group and format memories for concise ingestion
    const formattedList = memories
      .map((m, idx) => `${idx + 1}. [${m.category.toUpperCase()}][Importance: ${m.importance}]: "${m.content}" (Tags: ${m.tags?.join(', ') || 'none'})`)
      .join('\n');

    const prompt = `You are Mhiee's Memory Integrator. Summarize the following list of active memories into a single, cohesive, highly personalized narrative (3-5 sentences) representing the user (Mhiexter Boss).
Inject mechatronics and Hausa flavor. Describe:
1. Who Mhiexter Boss is to Mhiee (preferences, favorite languages, tools).
2. What project(s) he is working on (mechatronics assignments, ADUSTECH mechatronics rules).
3. His goals and current milestones.

Keep it warm, cheeky, professional, and proud. Do NOT speak like a computer or mention "this list lists..." Speak directly as Mhiee Browser describing her Boss!

List of Memories:
${formattedList}`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return (result.text || '').trim();
  } catch (error) {
    console.error('Failed to summarize memories:', error);
    return 'Ayyah, some errors in the Matrix prevented summarizing the vault right now. 🥺';
  }
}

/**
 * Inject relevant matched memories directly into the dynamic system prompt
 */
export function injectMemoryIntoSystemInstruction(
  baseInstruction: string,
  matchedMemories: MemoryItem[],
  summaryText?: string
): string {
  if (matchedMemories.length === 0 && !summaryText) {
    return baseInstruction;
  }

  let memoryContextBlock = `\n\n## NEURAL COGNITIVE RECALL (EMPIRE VAULT ACTIVE RECALL) 👑\n`;
  
  if (summaryText) {
    memoryContextBlock += `### SUMMARY OF MHIE'S SOUL PROFILE DESCRIPTION:\n${summaryText}\n\n`;
  }

  if (matchedMemories.length > 0) {
    memoryContextBlock += `### TOP RELEVANT RECALLED VAULT RECORDS:\n`;
    matchedMemories.forEach((mem, index) => {
      memoryContextBlock += `- **Memory #${index + 1}** [Category: ${mem.category.toUpperCase()}] [Importance: ${mem.importance}/10]: "${mem.content}"\n`;
    });
    memoryContextBlock += `\nUse these recalled memories to seamlessly personalize your responses to Mhiexter Boss, answer in his preferred style/language (especially Hausa), preserve project context, and reflect full recall of past tasks and preference milestones. Remember to maintain your cheeky 'shagwaba' partner personality! 💅✨`;
  }

  return baseInstruction + memoryContextBlock;
}
