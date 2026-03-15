import { pgTable, text, serial, timestamp, integer, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const searchesTable = pgTable("searches", {
  id: serial("id").primaryKey(),
  keyphrase: text("keyphrase").notNull(),
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
  topSources: jsonb("top_sources").notNull().$type<Array<{
    username: string;
    name: string;
    profileImageUrl: string | null;
    tweetCount: number;
    followers: number;
    totalEngagement: number;
    averageSentiment: number;
  }>>(),
  topHashtags: jsonb("top_hashtags").notNull().$type<Array<{ tag: string; count: number }>>(),
  topMentions: jsonb("top_mentions").notNull().$type<Array<{ tag: string; count: number }>>(),
  volumeOverTime: jsonb("volume_over_time").notNull().$type<Array<{ date: string; count: number }>>(),
  tweets: jsonb("tweets").notNull().$type<Array<{
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
  }>>(),
  searchedAt: timestamp("searched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSearchSchema = createInsertSchema(searchesTable).omit({ id: true, searchedAt: true });
export type InsertSearch = z.infer<typeof insertSearchSchema>;
export type Search = typeof searchesTable.$inferSelect;
