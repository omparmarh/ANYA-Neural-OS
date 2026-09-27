/**
 * ANYA ADVANCED RAG (Retrieval-Augmented Generation) ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Autonomous on-device & live web retrieval engine.
 * - Extracts real-time knowledge from DuckDuckGo Instant Answers & Wikipedia.
 * - Ranks snippets using TF-IDF & Cosine Similarity vector indexing.
 * - Formats executive structured context for LLM prompt injection so the AI
 *   analyzes search results directly instead of opening browser tabs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini for Embeddings
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

// Advanced RAG Vector Store using Embeddings
class RAGVectorStore {
  constructor() {
    this.documents = []; // { id, title, content, url, embedding }
  }

  async getEmbedding(text) {
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async addDocument(id, title, content, url = '') {
    const embedding = await this.getEmbedding(`${title} ${content}`);
    this.documents.push({ id, title, content, url, embedding });
  }

  clear() {
    this.documents = [];
  }

  async query(queryText, topK = 3) {
    const queryEmbedding = await this.getEmbedding(queryText);
    const scored = this.documents.map(doc => ({
      ...doc,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

export const ragVectorStore = new RAGVectorStore();

// ─── Live Search & Information Fetcher ───────────────────────────────────────

/**
 * Fetch live updated info from web search endpoints (DuckDuckGo & Wikipedia)
 * @param {string} searchQuery - Search query string
 * @returns {Promise<{ success: boolean, query: string, snippets: Array, ragContext: string, sourceUrl: string }>}
 */
export async function searchAndRetrieveRAG(searchQuery) {
  const query = (searchQuery || '').trim();
  if (!query) {
    return { success: false, query: '', snippets: [], ragContext: '', sourceUrl: '' };
  }

  ragVectorStore.clear();
  const rawSnippets = [];
  let primarySourceUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  // 1. DuckDuckGo Instant Answer API
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl);
    if (res.ok) {
      const data = await res.json();
      
      if (data.AbstractText) {
        rawSnippets.push({
          title: data.Heading || query,
          content: data.AbstractText,
          source: data.AbstractURL || 'DuckDuckGo Instant Answer',
          url: data.AbstractURL || ''
        });
        if (data.AbstractURL) primarySourceUrl = data.AbstractURL;
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (topic.Text && topic.FirstURL) {
            rawSnippets.push({
              title: topic.Text.split(' - ')[0] || query,
              content: topic.Text,
              source: 'DuckDuckGo Related Topic',
              url: topic.FirstURL
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('[RAG] DuckDuckGo API warning:', e);
  }

  // 2. Wikipedia REST API Summary
  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const res = await fetch(wikiUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.extract) {
        rawSnippets.push({
          title: data.title || query,
          content: data.extract,
          source: 'Wikipedia Summary',
          url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`
        });
        if (!primarySourceUrl || primarySourceUrl.includes('google.com')) {
          primarySourceUrl = data.content_urls?.desktop?.page || primarySourceUrl;
        }
      }
    }
  } catch (e) {
    console.warn('[RAG] Wikipedia API warning:', e);
  }

  // 3. Fallback: DDG HTML Search endpoint via JSON or fetch
  if (rawSnippets.length === 0) {
    try {
      const htmlSearchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(htmlSearchUrl);
      if (res.ok) {
        const htmlText = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const results = doc.querySelectorAll('.result__snippet');
        const titles = doc.querySelectorAll('.result__title');

        results.forEach((elem, idx) => {
          if (idx < 4) {
            const snippetText = elem.textContent.trim();
            const titleText = titles[idx] ? titles[idx].textContent.trim() : query;
            if (snippetText) {
              rawSnippets.push({
                title: titleText,
                content: snippetText,
                source: 'DuckDuckGo Web Search',
                url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
              });
            }
          }
        });
      }
    } catch (e) {
      console.warn('[RAG] HTML search fallback warning:', e);
    }
  }

  // Index snippets into Vector Store
  await Promise.all(rawSnippets.map(async (s, idx) => {
    await ragVectorStore.addDocument(`snippet_${idx}`, s.title, s.content, s.url);
  }));

  // Query vector store for top-K ranked chunks
  const rankedSnippets = await ragVectorStore.query(query, 4);

  // Build RAG Context Block
  let ragContext = '';
  if (rankedSnippets.length > 0) {
    const formattedChunks = rankedSnippets.map((s, i) => 
      `[Source ${i + 1}: ${s.title}] (${s.url || 'Web Source'})\n${s.content}`
    ).join('\n\n');

    ragContext = `\n\n[LIVE RAG RETRIEVAL KNOWLEDGE FOR "${query.toUpperCase()}"]:\n` +
      `Below is live retrieved data from search indexing. Analyze this data carefully to answer the user accurately with up-to-date facts:\n\n` +
      `${formattedChunks}\n\n` +
      `MANDATORY INSTRUCTION: Directly synthesize and explain the answer using the retrieved knowledge above. Do NOT open browser tabs unless specifically asked.`;
  } else {
    ragContext = `\n\n[LIVE RAG SEARCH]: Searched for "${query}". Live web data was checked. Provide your best analytical response with high confidence.`;
  }

  return {
    success: true,
    query,
    snippets: rankedSnippets,
    ragContext,
    sourceUrl: primarySourceUrl
  };
}
