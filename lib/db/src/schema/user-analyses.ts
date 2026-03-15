import { pgTable, text, serial, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";

export const userAnalysesTable = pgTable("user_analyses", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  profileData: jsonb("profile_data").notNull().$type<{
    id: string;
    name: string;
    username: string;
    description: string | null;
    createdAt: string | null;
    verified: boolean;
    profileImageUrl: string | null;
    followersCount: number;
    followingCount: number;
    tweetCount: number;
    listedCount: number;
  }>(),
  totalTweets: integer("total_tweets").notNull(),
  averageEngagement: real("average_engagement").notNull(),
  overallSentimentScore: real("overall_sentiment_score").notNull(),
  summary: text("summary").notNull(),
  keyThemes: jsonb("key_themes").notNull().$type<string[]>(),
  sentimentBreakdown: jsonb("sentiment_breakdown").notNull().$type<{
    positive: number;
    negative: number;
    neutral: number;
    positivePercent: number;
    negativePercent: number;
    neutralPercent: number;
  }>(),
  topHashtags: jsonb("top_hashtags").notNull().$type<Array<{ tag: string; count: number }>>(),
  topMentions: jsonb("top_mentions").notNull().$type<Array<{ tag: string; count: number }>>(),
  volumeOverTime: jsonb("volume_over_time").notNull().$type<Array<{ date: string; count: number }>>(),
  postingByDayOfWeek: jsonb("posting_by_day_of_week").notNull().$type<Array<{ day: string; count: number }>>(),
  postingByHour: jsonb("posting_by_hour").notNull().$type<Array<{ hour: number; count: number }>>(),
  topTweets: jsonb("top_tweets").notNull().$type<Array<{
    id: string;
    text: string;
    likes: number;
    retweets: number;
    replies: number;
    totalEngagement: number;
    sentiment: string;
    sentimentScore: number;
    createdAt: string;
  }>>(),
  tweets: jsonb("tweets").notNull().$type<Array<{
    id: string;
    text: string;
    sentiment: string;
    sentimentScore: number;
    likes: number;
    retweets: number;
    replies: number;
    createdAt: string;
  }>>(),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserAnalysis = typeof userAnalysesTable.$inferSelect;
