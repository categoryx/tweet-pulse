import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, searchesTable, userAnalysesTable } from "@workspace/db";
import {
  SearchTwitterBody,
  SearchTwitterResponse,
  ListSearchesResponse,
  GetSearchResultParams,
  GetSearchResultResponse,
  DeleteSearchParams,
  DeleteSearchResponse,
  AnalyzeUserBody,
  AnalyzeUserResponse,
  ListUserAnalysesResponse,
  GetUserAnalysisParams,
  GetUserAnalysisResponse,
  DeleteUserAnalysisParams,
  DeleteUserAnalysisResponse,
} from "@workspace/api-zod";
import { searchTweets, getUserByUsername, getUserTweets, type RawTweetData, type TwitterTweet } from "../../lib/twitter";
import { analyzeSentimentBatch, generateSummary, generateUserSummary } from "../../lib/sentiment";

interface SentimentBreakdownData {
  positive: number;
  negative: number;
  neutral: number;
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
}

interface TopSourceData {
  username: string;
  name: string;
  profileImageUrl: string | null;
  tweetCount: number;
  followers: number;
  totalEngagement: number;
  averageSentiment: number;
}

interface TagCountData {
  tag: string;
  count: number;
}

interface VolumePointData {
  date: string;
  count: number;
}

interface TweetItemData {
  id: string;
  text: string;
  authorUsername: string;
  authorName: string;
  authorProfileImageUrl: string | null;
  authorFollowers: number;
  sentiment: string;
  sentimentScore: number;
  likes: number;
  retweets: number;
  replies: number;
  createdAt: string;
}

interface SearchResultData {
  id: number;
  keyphrase: string;
  totalTweets: number;
  averageEngagement: number;
  overallSentimentScore: number;
  summary: string;
  keyThemes: string[];
  sentimentBreakdown: SentimentBreakdownData;
  topSources: TopSourceData[];
  topHashtags: TagCountData[];
  topMentions: TagCountData[];
  volumeOverTime: VolumePointData[];
  tweets: TweetItemData[];
  searchedAt: string;
}

function formatSearchResult(search: typeof searchesTable.$inferSelect): SearchResultData {
  return {
    id: search.id,
    keyphrase: search.keyphrase,
    totalTweets: search.totalTweets,
    averageEngagement: search.averageEngagement,
    overallSentimentScore: search.overallSentimentScore,
    summary: search.summary,
    keyThemes: search.keyThemes as string[],
    sentimentBreakdown: search.sentimentBreakdown as SentimentBreakdownData,
    topSources: search.topSources as TopSourceData[],
    topHashtags: search.topHashtags as TagCountData[],
    topMentions: search.topMentions as TagCountData[],
    volumeOverTime: search.volumeOverTime as VolumePointData[],
    tweets: search.tweets as TweetItemData[],
    searchedAt: search.searchedAt.toISOString(),
  };
}

function computeSentimentBreakdown(sentiments: Array<{ sentiment: string }>): SentimentBreakdownData {
  const positive = sentiments.filter((t) => t.sentiment === "positive").length;
  const negative = sentiments.filter((t) => t.sentiment === "negative").length;
  const neutral = sentiments.filter((t) => t.sentiment === "neutral").length;
  const total = sentiments.length;
  return {
    positive,
    negative,
    neutral,
    positivePercent: total > 0 ? Math.round((positive / total) * 100) : 0,
    negativePercent: total > 0 ? Math.round((negative / total) * 100) : 0,
    neutralPercent: total > 0 ? Math.round((neutral / total) * 100) : 0,
  };
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to search Twitter";
    res.status(400).json({ error: message });
    return;
  }

  if (rawTweets.length === 0) {
    res.status(400).json({ error: "No tweets found for this keyphrase. Try a different search term." });
    return;
  }

  let sentimentMap: Map<string, { sentiment: string; score: number }>;
  try {
    sentimentMap = await analyzeSentimentBatch(
      rawTweets.map((t) => ({ id: t.tweet.id, text: t.tweet.text }))
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sentiment analysis failed";
    res.status(500).json({ error: message });
    return;
  }

  const tweetsWithSentiment: TweetItemData[] = rawTweets.map((raw) => {
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

  const total = tweetsWithSentiment.length;
  const sentimentBreakdown = computeSentimentBreakdown(tweetsWithSentiment);

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

  const topSources: TopSourceData[] = Array.from(sourceMap.values())
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

  const topHashtags: TagCountData[] = Array.from(hashtagMap.entries())
    .map(([tag, count]) => ({ tag: `#${tag}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const topMentions: TagCountData[] = Array.from(mentionMap.entries())
    .map(([tag, count]) => ({ tag: `@${tag}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const dateMap = new Map<string, number>();
  for (const tweet of tweetsWithSentiment) {
    const date = tweet.createdAt ? tweet.createdAt.split("T")[0] : "unknown";
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  }
  const volumeOverTime: VolumePointData[] = Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let summary: string;
  let keyThemes: string[];
  try {
    const summaryResult = await generateSummary(
      keyphrase,
      tweetsWithSentiment.map((t) => ({ text: t.text, sentiment: t.sentiment })),
      sentimentBreakdown
    );
    summary = summaryResult.summary;
    keyThemes = Array.isArray(summaryResult.keyThemes) ? summaryResult.keyThemes : [];
  } catch (err: unknown) {
    summary = `Unable to generate summary for "${keyphrase}".`;
    keyThemes = [];
  }

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

  const result = formatSearchResult(savedSearch);
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

  const result = formatSearchResult(search);
  res.json(GetSearchResultResponse.parse(result));
});

router.delete("/twitter/searches/:id", async (req, res): Promise<void> => {
  const params = DeleteSearchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(searchesTable)
    .where(eq(searchesTable.id, params.data.id))
    .returning({ id: searchesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Search not found" });
    return;
  }

  res.json(DeleteSearchResponse.parse({ success: true }));
});

router.post("/twitter/user-analysis", async (req, res): Promise<void> => {
  const parsed = AnalyzeUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, maxResults } = parsed.data;
  const cleanUsername = username.replace(/^@/, "");

  let userProfile: Awaited<ReturnType<typeof getUserByUsername>>;
  try {
    userProfile = await getUserByUsername(cleanUsername);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to look up user";
    res.status(400).json({ error: message });
    return;
  }

  let rawTweets: TwitterTweet[];
  try {
    rawTweets = await getUserTweets(userProfile.id, maxResults ?? 100);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch user tweets";
    res.status(400).json({ error: message });
    return;
  }

  if (rawTweets.length === 0) {
    res.status(400).json({ error: "No recent tweets found for this user." });
    return;
  }

  let sentimentMap: Map<string, { sentiment: string; score: number }>;
  try {
    sentimentMap = await analyzeSentimentBatch(
      rawTweets.map((t) => ({ id: t.id, text: t.text }))
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sentiment analysis failed";
    res.status(500).json({ error: message });
    return;
  }

  const tweetsWithSentiment = rawTweets.map((tweet) => {
    const sentiment = sentimentMap.get(tweet.id) || { sentiment: "neutral" as const, score: 0 };
    return {
      id: tweet.id,
      text: tweet.text,
      sentiment: sentiment.sentiment,
      sentimentScore: sentiment.score,
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      replies: tweet.public_metrics?.reply_count || 0,
      createdAt: tweet.created_at,
    };
  });

  const total = tweetsWithSentiment.length;
  const sentimentBreakdown = computeSentimentBreakdown(tweetsWithSentiment);

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

  const hashtagMap = new Map<string, number>();
  const mentionMap = new Map<string, number>();
  for (const tweet of rawTweets) {
    if (tweet.entities?.hashtags) {
      for (const h of tweet.entities.hashtags) {
        hashtagMap.set(h.tag.toLowerCase(), (hashtagMap.get(h.tag.toLowerCase()) || 0) + 1);
      }
    }
    if (tweet.entities?.mentions) {
      for (const m of tweet.entities.mentions) {
        mentionMap.set(m.username, (mentionMap.get(m.username) || 0) + 1);
      }
    }
  }

  const topHashtags: TagCountData[] = Array.from(hashtagMap.entries())
    .map(([tag, count]) => ({ tag: `#${tag}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const topMentions: TagCountData[] = Array.from(mentionMap.entries())
    .map(([tag, count]) => ({ tag: `@${tag}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const dateMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  const hourMap = new Map<number, number>();
  for (const tweet of tweetsWithSentiment) {
    if (tweet.createdAt) {
      const d = new Date(tweet.createdAt);
      const dateStr = tweet.createdAt.split("T")[0];
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
      const dayName = DAY_NAMES[(d.getUTCDay() + 6) % 7];
      dayMap.set(dayName, (dayMap.get(dayName) || 0) + 1);
      hourMap.set(d.getUTCHours(), (hourMap.get(d.getUTCHours()) || 0) + 1);
    }
  }

  const volumeOverTime: VolumePointData[] = Array.from(dateMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const postingByDayOfWeek = DAY_NAMES.map((day) => ({
    day,
    count: dayMap.get(day) || 0,
  }));

  const postingByHour = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourMap.get(i) || 0,
  }));

  const topTweets = [...tweetsWithSentiment]
    .map((t) => ({
      ...t,
      totalEngagement: t.likes + t.retweets + t.replies,
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 10);

  const profileData = {
    id: userProfile.id,
    name: userProfile.name,
    username: userProfile.username,
    description: userProfile.description || null,
    createdAt: userProfile.created_at || null,
    verified: userProfile.verified || false,
    profileImageUrl: userProfile.profile_image_url || null,
    followersCount: userProfile.public_metrics?.followers_count || 0,
    followingCount: userProfile.public_metrics?.following_count || 0,
    tweetCount: userProfile.public_metrics?.tweet_count || 0,
    listedCount: userProfile.public_metrics?.listed_count || 0,
  };

  let summary: string;
  let keyThemes: string[];
  try {
    const summaryResult = await generateUserSummary(
      cleanUsername,
      profileData,
      tweetsWithSentiment.map((t) => ({ text: t.text, sentiment: t.sentiment })),
      sentimentBreakdown
    );
    summary = summaryResult.summary;
    keyThemes = Array.isArray(summaryResult.keyThemes) ? summaryResult.keyThemes : [];
  } catch (err: unknown) {
    summary = `Unable to generate summary for @${cleanUsername}.`;
    keyThemes = [];
  }

  const [saved] = await db
    .insert(userAnalysesTable)
    .values({
      username: cleanUsername,
      profileData,
      totalTweets: total,
      averageEngagement,
      overallSentimentScore,
      summary,
      keyThemes,
      sentimentBreakdown,
      topHashtags,
      topMentions,
      volumeOverTime,
      postingByDayOfWeek,
      postingByHour,
      topTweets,
      tweets: tweetsWithSentiment,
    })
    .returning();

  const result = {
    id: saved.id,
    username: saved.username,
    profileData: saved.profileData,
    totalTweets: saved.totalTweets,
    averageEngagement: saved.averageEngagement,
    overallSentimentScore: saved.overallSentimentScore,
    summary: saved.summary,
    keyThemes: saved.keyThemes,
    sentimentBreakdown: saved.sentimentBreakdown,
    topHashtags: saved.topHashtags,
    topMentions: saved.topMentions,
    volumeOverTime: saved.volumeOverTime,
    postingByDayOfWeek: saved.postingByDayOfWeek,
    postingByHour: saved.postingByHour,
    topTweets: saved.topTweets,
    tweets: saved.tweets,
    analyzedAt: saved.analyzedAt.toISOString(),
  };

  res.json(AnalyzeUserResponse.parse(result));
});

router.get("/twitter/user-analyses", async (_req, res): Promise<void> => {
  const analyses = await db
    .select({
      id: userAnalysesTable.id,
      username: userAnalysesTable.username,
      totalTweets: userAnalysesTable.totalTweets,
      overallSentimentScore: userAnalysesTable.overallSentimentScore,
      analyzedAt: userAnalysesTable.analyzedAt,
    })
    .from(userAnalysesTable)
    .orderBy(desc(userAnalysesTable.analyzedAt));

  const formatted = analyses.map((a) => ({
    ...a,
    analyzedAt: a.analyzedAt.toISOString(),
  }));

  res.json(ListUserAnalysesResponse.parse(formatted));
});

router.get("/twitter/user-analyses/:id", async (req, res): Promise<void> => {
  const params = GetUserAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(userAnalysesTable)
    .where(eq(userAnalysesTable.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "User analysis not found" });
    return;
  }

  const result = {
    id: analysis.id,
    username: analysis.username,
    profileData: analysis.profileData,
    totalTweets: analysis.totalTweets,
    averageEngagement: analysis.averageEngagement,
    overallSentimentScore: analysis.overallSentimentScore,
    summary: analysis.summary,
    keyThemes: analysis.keyThemes,
    sentimentBreakdown: analysis.sentimentBreakdown,
    topHashtags: analysis.topHashtags,
    topMentions: analysis.topMentions,
    volumeOverTime: analysis.volumeOverTime,
    postingByDayOfWeek: analysis.postingByDayOfWeek,
    postingByHour: analysis.postingByHour,
    topTweets: analysis.topTweets,
    tweets: analysis.tweets,
    analyzedAt: analysis.analyzedAt.toISOString(),
  };

  res.json(GetUserAnalysisResponse.parse(result));
});

router.delete("/twitter/user-analyses/:id", async (req, res): Promise<void> => {
  const params = DeleteUserAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(userAnalysesTable)
    .where(eq(userAnalysesTable.id, params.data.id))
    .returning({ id: userAnalysesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "User analysis not found" });
    return;
  }

  res.json(DeleteUserAnalysisResponse.parse({ success: true }));
});

export default router;
