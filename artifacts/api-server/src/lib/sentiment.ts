import { openai } from "@workspace/integrations-openai-ai-server";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";

export interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral";
  score: number;
}

export async function analyzeSentimentBatch(
  tweets: Array<{ id: string; text: string }>
): Promise<Map<string, SentimentResult>> {
  const results = new Map<string, SentimentResult>();

  const batchResults = await batchProcess(
    tweets,
    async (tweet) => {
      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 100,
        messages: [
          {
            role: "system",
            content:
              'You are a sentiment analyzer. Classify the tweet as "positive", "negative", or "neutral". Return ONLY a JSON object: {"sentiment":"positive"|"negative"|"neutral","score":number} where score is -1.0 (most negative) to 1.0 (most positive). No other text.',
          },
          { role: "user", content: tweet.text },
        ],
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      try {
        const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return {
          id: tweet.id,
          sentiment: parsed.sentiment as "positive" | "negative" | "neutral",
          score: typeof parsed.score === "number" ? parsed.score : 0,
        };
      } catch {
        return { id: tweet.id, sentiment: "neutral" as const, score: 0 };
      }
    },
    { concurrency: 5, retries: 3 }
  );

  for (const result of batchResults) {
    if (result.status === "fulfilled") {
      results.set(result.value.id, {
        sentiment: result.value.sentiment,
        score: result.value.score,
      });
    }
  }

  return results;
}

export async function generateSummary(
  keyphrase: string,
  tweets: Array<{ text: string; sentiment: string }>,
  sentimentBreakdown: { positive: number; negative: number; neutral: number }
): Promise<{ summary: string; keyThemes: string[] }> {
  const sampleTweets = tweets.slice(0, 30).map((t) => `[${t.sentiment}] ${t.text}`).join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "system",
        content:
          "You analyze Twitter conversations. Return ONLY a JSON object with: {\"summary\": \"2-3 paragraph narrative summary of the conversation\", \"keyThemes\": [\"theme1\", \"theme2\", ...]} (max 6 themes). Be specific and insightful.",
      },
      {
        role: "user",
        content: `Keyphrase: "${keyphrase}"
Sentiment breakdown: ${sentimentBreakdown.positive} positive, ${sentimentBreakdown.negative} negative, ${sentimentBreakdown.neutral} neutral
Sample tweets:
${sampleTweets}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim() || "";
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      summary: "Unable to generate summary for this search.",
      keyThemes: [keyphrase],
    };
  }
}
