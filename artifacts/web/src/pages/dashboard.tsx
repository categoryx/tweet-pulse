import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Search,
  TrendingUp,
  BarChart3,
  MessageSquare,
  Users,
  Heart,
  Repeat2,
  Hash,
  AtSign,
  Clock,
  Loader2,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Activity,
} from "lucide-react";
interface SentimentBreakdown {
  positive: number;
  negative: number;
  neutral: number;
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
}

interface TopSource {
  username: string;
  name: string;
  profileImageUrl: string | null;
  tweetCount: number;
  followers: number;
  totalEngagement: number;
  averageSentiment: number;
}

interface TagCount {
  tag: string;
  count: number;
}

interface VolumePoint {
  date: string;
  count: number;
}

interface TweetItem {
  id: string;
  text: string;
  authorUsername: string;
  authorName: string;
  authorProfileImageUrl: string | null;
  authorFollowers: number;
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  likes: number;
  retweets: number;
  replies: number;
  createdAt: string;
}

interface SearchResult {
  id: number;
  keyphrase: string;
  totalTweets: number;
  averageEngagement: number;
  overallSentimentScore: number;
  summary: string;
  keyThemes: string[];
  sentimentBreakdown: SentimentBreakdown;
  topSources: TopSource[];
  topHashtags: TagCount[];
  topMentions: TagCount[];
  volumeOverTime: VolumePoint[];
  tweets: TweetItem[];
  searchedAt: string;
}

interface SearchHistoryItem {
  id: number;
  keyphrase: string;
  totalTweets: number;
  overallSentimentScore: number;
  searchedAt: string;
}

const SENTIMENT_COLORS = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#6b7280",
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config = {
    positive: { icon: ThumbsUp, className: "bg-green-500/15 text-green-500 border-green-500/20" },
    negative: { icon: ThumbsDown, className: "bg-red-500/15 text-red-500 border-red-500/20" },
    neutral: { icon: Minus, className: "bg-gray-500/15 text-gray-400 border-gray-500/20" },
  };
  const c = config[sentiment as keyof typeof config] || config.neutral;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.className}`}>
      <Icon className="w-3 h-3" />
      {sentiment}
    </span>
  );
}

export default function Dashboard() {
  const [searchInput, setSearchInput] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const queryClient = useQueryClient();

  const historyQuery = useQuery<SearchHistoryItem[]>({
    queryKey: ["searches"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/twitter/searches`);
      return res.json();
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (keyphrase: string) => {
      const res = await fetch(`${BASE}/api/twitter/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyphrase, maxResults: 50 }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Search failed");
      }
      return res.json() as Promise<SearchResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["searches"] });
    },
  });

  const loadResultMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/twitter/searches/${id}`);
      if (!res.ok) throw new Error("Failed to load result");
      return res.json() as Promise<SearchResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setSearchInput(data.keyphrase);
    },
  });

  const handleSearch = () => {
    if (!searchInput.trim()) return;
    searchMutation.mutate(searchInput.trim());
  };

  const isLoading = searchMutation.isPending || loadResultMutation.isPending;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="flex h-screen">
        <aside className="w-72 border-r border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 text-primary" />
              <h1 className="font-bold text-lg">Tweet Pulse</h1>
            </div>
            <p className="text-xs text-muted-foreground">Twitter/X News Intelligence</p>
          </div>
          <div className="p-3 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Recent Searches
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {historyQuery.data?.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadResultMutation.mutate(item.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors group"
                >
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {item.keyphrase}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {item.totalTweets} tweets
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.overallSentimentScore >= 0 ? "+" : ""}
                      {item.overallSentimentScore.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(item.searchedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
              {historyQuery.data?.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No searches yet. Try searching for a topic above.
                </p>
              )}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-card">
            <div className="flex gap-2 max-w-2xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Enter a keyphrase to search Twitter..."
                  className="pl-9 h-10 bg-background"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleSearch} disabled={isLoading || !searchInput.trim()} className="h-10 px-6">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
            {searchMutation.isError && (
              <p className="text-sm text-destructive text-center mt-2">
                {searchMutation.error.message}
              </p>
            )}
          </div>

          <ScrollArea className="flex-1">
            {isLoading && <LoadingState />}
            {!isLoading && result && <ResultsDashboard result={result} />}
            {!isLoading && !result && <EmptyState />}
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Search className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Search Twitter for Insights</h2>
        <p className="text-sm text-muted-foreground">
          Enter a keyphrase to analyze Twitter conversations. Get sentiment analysis, top sources,
          trending hashtags, and an AI-generated summary of the discussion.
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-1">Analyzing tweets...</h3>
          <p className="text-sm text-muted-foreground">
            Fetching tweets, running sentiment analysis, and generating insights. This may take 15-30 seconds.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

function ResultsDashboard({ result }: { result: SearchResult }) {
  const sentimentPieData = [
    { name: "Positive", value: result.sentimentBreakdown.positive, color: SENTIMENT_COLORS.positive },
    { name: "Negative", value: result.sentimentBreakdown.negative, color: SENTIMENT_COLORS.negative },
    { name: "Neutral", value: result.sentimentBreakdown.neutral, color: SENTIMENT_COLORS.neutral },
  ];

  const mostActiveSource = result.topSources[0];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            Results for &ldquo;{result.keyphrase}&rdquo;
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Searched {formatDate(result.searchedAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={MessageSquare}
          label="Total Tweets"
          value={result.totalTweets.toString()}
          subtext="analyzed"
          color="text-blue-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Engagement"
          value={formatNumber(result.averageEngagement)}
          subtext="per tweet"
          color="text-amber-400"
        />
        <StatCard
          icon={BarChart3}
          label="Sentiment Score"
          value={result.overallSentimentScore >= 0 ? `+${result.overallSentimentScore.toFixed(2)}` : result.overallSentimentScore.toFixed(2)}
          subtext={result.overallSentimentScore > 0.2 ? "positive" : result.overallSentimentScore < -0.2 ? "negative" : "neutral"}
          color={result.overallSentimentScore > 0.2 ? "text-green-400" : result.overallSentimentScore < -0.2 ? "text-red-400" : "text-gray-400"}
        />
        <StatCard
          icon={Users}
          label="Top Source"
          value={mostActiveSource ? `@${mostActiveSource.username}` : "N/A"}
          subtext={mostActiveSource ? `${mostActiveSource.tweetCount} tweets` : ""}
          color="text-purple-400"
        />
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            AI Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {result.summary}
          </p>
          {result.keyThemes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {result.keyThemes.map((theme) => (
                <Badge key={theme} variant="secondary" className="text-xs">
                  {theme}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sentiment Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={sentimentPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="value"
                    stroke="none"
                  >
                    {sentimentPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222 47% 11%)",
                      border: "1px solid hsl(217 33% 17%)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 flex-1">
                {sentimentPieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{item.value}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({result.sentimentBreakdown[`${item.name.toLowerCase()}Percent` as keyof SentimentBreakdown]}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Volume Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={result.volumeOverTime}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210 100% 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(210 100% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222 47% 11%)",
                    border: "1px solid hsl(217 33% 17%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(210 100% 50%)"
                  fill="url(#colorVolume)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Top Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Account</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Followers</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Tweets</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Engagement</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {result.topSources.slice(0, 10).map((source) => (
                  <tr key={source.username} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        {source.profileImageUrl ? (
                          <img src={source.profileImageUrl} alt="" className="w-7 h-7 rounded-full" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {source.name[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{source.name}</p>
                          <p className="text-xs text-muted-foreground">@{source.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-right text-muted-foreground">{formatNumber(source.followers)}</td>
                    <td className="text-right">{source.tweetCount}</td>
                    <td className="text-right text-muted-foreground">{formatNumber(source.totalEngagement)}</td>
                    <td className="text-right">
                      <span
                        className={`text-xs font-medium ${
                          source.averageSentiment > 0.2
                            ? "text-green-400"
                            : source.averageSentiment < -0.2
                            ? "text-red-400"
                            : "text-gray-400"
                        }`}
                      >
                        {source.averageSentiment >= 0 ? "+" : ""}{source.averageSentiment.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Top Hashtags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.topHashtags.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(result.topHashtags.slice(0, 8).length * 32, 100)}>
                <BarChart data={result.topHashtags.slice(0, 8)} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
                  <YAxis dataKey="tag" type="category" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} width={60} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222 47% 11%)",
                      border: "1px solid hsl(217 33% 17%)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(210 100% 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No hashtags found</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AtSign className="w-4 h-4" />
              Top Mentions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.topMentions.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(result.topMentions.slice(0, 8).length * 32, 100)}>
                <BarChart data={result.topMentions.slice(0, 8)} layout="vertical" margin={{ left: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
                  <YAxis dataKey="tag" type="category" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} width={70} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222 47% 11%)",
                      border: "1px solid hsl(217 33% 17%)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(262 83% 63%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No mentions found</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Tweet Feed ({result.tweets.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {result.tweets.map((tweet) => (
            <div key={tweet.id} className="p-3 rounded-lg hover:bg-accent/50 transition-colors border border-transparent hover:border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {tweet.authorProfileImageUrl ? (
                    <img src={tweet.authorProfileImageUrl} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {tweet.authorName[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{tweet.authorName}</span>
                      <span className="text-xs text-muted-foreground">@{tweet.authorUsername}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatNumber(tweet.authorFollowers)} followers
                      </span>
                    </div>
                    <p className="text-sm mt-1 text-foreground/90 break-words">{tweet.text}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Heart className="w-3 h-3" /> {formatNumber(tweet.likes)}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Repeat2 className="w-3 h-3" /> {formatNumber(tweet.retweets)}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> {formatNumber(tweet.replies)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDate(tweet.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <SentimentBadge sentiment={tweet.sentiment} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  subtext: string;
  color: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>
          </div>
          <div className={`p-2 rounded-lg bg-accent ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
