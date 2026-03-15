import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, searchesTable } from "@workspace/db";
import {
  SearchTwitterBody,
  SearchTwitterResponse,
  ListSearchesResponse,
  GetSearchResultParams,
  GetSearchResultResponse,
} from "@workspace/api-zod";
import { searchTweets, type RawTweetData } from "../../lib/twitter";
import { analyzeSentimentBatch, generateSummary } from "../../lib/sentiment";

const router: IRouter = Router();

router.post("/twitter/search", async (req, res): Promise<void> => {
  const parsed = SearchTwitterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { keyphrase, maxResults } = parsed.data;

  let rawTweets: RawTweetData[];
  try {
    rawTweets = await searchTweets(keyphrase, maxResults ?? 50);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to search Twitter" });
    return;
  }

  if (rawTweets.length === 0) {
    res.status(400).json({ error: "No tweets found for this keyphrase. Try a different search term." });
    return;
  }

  const sentimentMap = await analyzeSentimentBatch(
    rawTweets.map((t) => ({ id: t.tweet.id, text: t.tweet.text }))
  );

  const tweetsWithSentiment = rawTweets.map((raw) => {
    const sentiment = sentimentMap.get(raw.tweet.id) || {
      sentiment: "neutral" as const,
      score: 0,
    };
    return {
      id: raw.tweet.id,
      text: raw.tweet.text,
      authorUsername: raw.author.username,
      authorName: raw.author.name,
      authorProfileImageUrl: raw.author.profile_image_url || null,
      authorFollowers: raw.author.public_metrics?.followers_count || 0,
      sentiment: sentiment.sentiment,
      sentimentScore: sentiment.score,
      likes: raw.tweet.public_metrics?.like_count || 0,
      retweets: raw.tweet.public_metrics?.retweet_count || 0,
      replies: raw.tweet.public_metrics?.reply_count || 0,
      createdAt: raw.tweet.created_at,
    };
  });

  const positive = tweetsWithSentiment.filter((t) => t.sentiment === "positive").length;
  const negative = tweetsWithSentiment.filter((t) => t.sentiment === "negative").length;
  const neutral = tweetsWithSentiment.filter((t) => t.sentiment === "neutral").length;
  const total = tweetsWithSentiment.length;

  const sentimentBreakdown = {
    positive,
    negative,
    neutral,
    positivePercent: total > 0 ? Math.round((positive / total) * 100) : 0,
    negativePercent: total > 0 ? Math.round((negative / total) * 100) : 0,
    neutralPercent: total > 0 ? Math.round((neutral / total) * 100) : 0,
  };

  const totalEngagement = tweetsWithSentiment.reduce(
    (sum, t) => sum + t.likes + t.retweets + t.replies,
    0
  );
  const averageEngagement = total > 0 ? Math.round(totalEngagement / total) : 0;

  const overallSentimentScore =
    total > 0
      ? Math.round(
          (tweetsWithSentiment.reduce((sum, t) => sum + t.sentimentScore, 0) / total) * 100
        ) / 100
      : 0;

  const sourceMap = new Map<
    string,
    {
      username: string;
      name: string;
      profileImageUrl: string | null;
      tweetCount: number;
      followers: number;
      totalEngagement: number;
      sentimentSum: number;
    }
  >();

  for (const tweet of tweetsWithSentiment) {
    const existing = sourceMap.get(tweet.authorUsername);
    const engagement = tweet.likes + tweet.retweets + tweet.replies;
    if (existing) {
      existing.tweetCount++;
      existing.totalEngagement += engagement;
      existing.sentimentSum += tweet.sentimentScore;
    } else {
      sourceMap.set(tweet.authorUsername, {
        username: tweet.authorUsername,
        name: tweet.authorName,
        profileImageUrl: tweet.authorProfileImageUrl,
        tweetCount: 1,
        followers: tweet.authorFollowers,
        totalEngagement: engagement,
        sentimentSum: tweet.sentimentScore,
      });
    }
  }

  const topSources = Array.from(sourceMap.values())
    .map((s) => ({
      username: s.username,
      name: s.name,
      profileImageUrl: s.profileImageUrl,
      tweetCount: s.tweetCount,
      followers: s.followers,
      totalEngagement: s.totalEngagement,
      averageSentiment: Math.round((s.sentimentSum / s.tweetCount) * 100) / 100,
    }))
    .sort((a, b) => b.tweetCount - a.tweetCount || b.followers - a.followers)
    .slice(0, 15);

  const hashtagMap = new Map<string, number>();
  const mentionMap = new Map<string, number>();
  for (const raw of rawTweets) {
    if (raw.tweet.entities?.hashtags) {
      for (const h of raw.tweet.entities.hashtags) {
        hashtagMap.set(h.tag.toLowerCase(), (hashtagMap.get(h.tag.toLowerCase()) || 0) + 1);
      }
    }
    if (raw.tweet.entities?.mentions) {
      for (const m of raw.tweet.entities.mentions) {
        mentionMap.set(m.username, (mentionMap.get(m.username) || 0) + 1);
      }
    }
  }

  const topHashtags = Array.from(hashtagMap.entries())
    .map(([tag, count]) => ({ tag: `#${tag}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const topMentions = Array.from(mentionMap.entries())
    .map(([tag, count]) => ({ tag: `@${tag}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const dateMap = new Map<string, number>();
  for (const tweet of tweetsWithSentiment) {
    const date = tweet.createdAt ? tweet.createdAt.split("T")[0] : "unknown";
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  }
  const volumeOverTime = Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const { summary, keyThemes } = await generateSummary(
    keyphrase,
    tweetsWithSentiment.map((t) => ({ text: t.text, sentiment: t.sentiment })),
    sentimentBreakdown
  );

  const [savedSearch] = await db
    .insert(searchesTable)
    .values({
      keyphrase,
      totalTweets: total,
      averageEngagement,
      overallSentimentScore,
      summary,
      keyThemes,
      sentimentBreakdown,
      topSources,
      topHashtags,
      topMentions,
      volumeOverTime,
      tweets: tweetsWithSentiment,
    })
    .returning();

  const result = {
    id: savedSearch.id,
    keyphrase: savedSearch.keyphrase,
    totalTweets: savedSearch.totalTweets,
    averageEngagement: savedSearch.averageEngagement,
    overallSentimentScore: savedSearch.overallSentimentScore,
    summary: savedSearch.summary,
    keyThemes: savedSearch.keyThemes as string[],
    sentimentBreakdown: savedSearch.sentimentBreakdown as any,
    topSources: savedSearch.topSources as any[],
    topHashtags: savedSearch.topHashtags as any[],
    topMentions: savedSearch.topMentions as any[],
    volumeOverTime: savedSearch.volumeOverTime as any[],
    tweets: savedSearch.tweets as any[],
    searchedAt: savedSearch.searchedAt.toISOString(),
  };

  res.json(SearchTwitterResponse.parse(result));
});

router.get("/twitter/searches", async (_req, res): Promise<void> => {
  const searches = await db
    .select({
      id: searchesTable.id,
      keyphrase: searchesTable.keyphrase,
      totalTweets: searchesTable.totalTweets,
      overallSentimentScore: searchesTable.overallSentimentScore,
      searchedAt: searchesTable.searchedAt,
    })
    .from(searchesTable)
    .orderBy(desc(searchesTable.searchedAt));

  const formatted = searches.map((s) => ({
    ...s,
    searchedAt: s.searchedAt.toISOString(),
  }));

  res.json(ListSearchesResponse.parse(formatted));
});

router.get("/twitter/searches/:id", async (req, res): Promise<void> => {
  const params = GetSearchResultParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [search] = await db
    .select()
    .from(searchesTable)
    .where(eq(searchesTable.id, params.data.id));

  if (!search) {
    res.status(404).json({ error: "Search not found" });
    return;
  }

  const result = {
    id: search.id,
    keyphrase: search.keyphrase,
    totalTweets: search.totalTweets,
    averageEngagement: search.averageEngagement,
    overallSentimentScore: search.overallSentimentScore,
    summary: search.summary,
    keyThemes: search.keyThemes as string[],
    sentimentBreakdown: search.sentimentBreakdown as any,
    topSources: search.topSources as any[],
    topHashtags: search.topHashtags as any[],
    topMentions: search.topMentions as any[],
    volumeOverTime: search.volumeOverTime as any[],
    tweets: search.tweets as any[],
    searchedAt: search.searchedAt.toISOString(),
  };

  res.json(GetSearchResultResponse.parse(result));
});

export default router;
