import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "recharts";
import {
  TrendingUp,
  BarChart3,
  MessageSquare,
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
  User,
  Calendar,
  ExternalLink,
  Trash2,
  Download,
} from "lucide-react";

interface SentimentBreakdown {
  positive: number;
  negative: number;
  neutral: number;
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
}

interface ProfileData {
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
}

interface TagCount {
  tag: string;
  count: number;
}

interface VolumePoint {
  date: string;
  count: number;
}

interface DayOfWeekCount {
  day: string;
  count: number;
}

interface HourCount {
  hour: number;
  count: number;
}

interface TopTweetItem {
  id: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  totalEngagement: number;
  sentiment: string;
  sentimentScore: number;
  createdAt: string;
}

interface UserTweetItem {
  id: string;
  text: string;
  sentiment: string;
  sentimentScore: number;
  likes: number;
  retweets: number;
  replies: number;
  createdAt: string;
}

interface UserAnalysisResult {
  id: number;
  username: string;
  profileData: ProfileData;
  totalTweets: number;
  averageEngagement: number;
  overallSentimentScore: number;
  summary: string;
  keyThemes: string[];
  sentimentBreakdown: SentimentBreakdown;
  topHashtags: TagCount[];
  topMentions: TagCount[];
  volumeOverTime: VolumePoint[];
  postingByDayOfWeek: DayOfWeekCount[];
  postingByHour: HourCount[];
  topTweets: TopTweetItem[];
  tweets: UserTweetItem[];
  analyzedAt: string;
}

interface UserAnalysisHistoryItem {
  id: number;
  username: string;
  totalTweets: number;
  overallSentimentScore: number;
  analyzedAt: string;
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

function downloadCsv(result: UserAnalysisResult) {
  const headers = ["Tweet ID", "Text", "Sentiment", "Score", "Likes", "Retweets", "Replies", "Date"];
  const rows = result.tweets.map((t) => [
    t.id,
    `"${t.text.replace(/"/g, '""')}"`,
    t.sentiment,
    t.sentimentScore.toString(),
    t.likes.toString(),
    t.retweets.toString(),
    t.replies.toString(),
    t.createdAt,
  ]);
  const profileRow = [
    `"Profile: @${result.profileData.username}"`,
    `"${result.profileData.name}"`,
    `"Followers: ${result.profileData.followersCount}"`,
    `"Following: ${result.profileData.followingCount}"`,
    `"Total Tweets: ${result.profileData.tweetCount}"`,
    `"Sentiment: ${result.overallSentimentScore}"`,
    `"Avg Engagement: ${result.averageEngagement}"`,
    `"Analyzed: ${result.analyzedAt}"`,
  ];
  const csv = [profileRow.join(","), "", headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `user-analysis-${result.username}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(222 47% 11%)",
  border: "1px solid hsl(217 33% 17%)",
  borderRadius: "8px",
  fontSize: "12px",
};
const TICK_STYLE = { fontSize: 11, fill: "hsl(215 20% 55%)" };
const GRID_STROKE = "hsl(217 33% 17%)";

export default function UserAnalysisPage() {
  const [usernameInput, setUsernameInput] = useState("");
  const [result, setResult] = useState<UserAnalysisResult | null>(null);
  const queryClient = useQueryClient();

  const historyQuery = useQuery<UserAnalysisHistoryItem[]>({
    queryKey: ["user-analyses"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/twitter/user-analyses`);
      if (!res.ok) throw new Error("Failed to load analysis history");
      return res.json();
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await fetch(`${BASE}/api/twitter/user-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, maxResults: 100 }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }
      return res.json() as Promise<UserAnalysisResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["user-analyses"] });
    },
  });

  const loadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/twitter/user-analyses/${id}`);
      if (!res.ok) throw new Error("Failed to load result");
      return res.json() as Promise<UserAnalysisResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setUsernameInput(data.username);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/twitter/user-analyses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["user-analyses"] });
      if (result?.id === deletedId) setResult(null);
    },
  });

  const handleAnalyze = () => {
    if (!usernameInput.trim()) return;
    analyzeMutation.mutate(usernameInput.trim());
  };

  const isLoading = analyzeMutation.isPending || loadMutation.isPending;

  return (
    <div className="flex h-full">
      <aside className="w-72 border-r border-border bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Recent Analyses
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {historyQuery.data?.map((item) => (
              <div key={item.id} className="group relative">
                <button
                  onClick={() => loadMutation.mutate(item.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors"
                >
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    @{item.username}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{item.totalTweets} tweets</span>
                    <span className="text-xs text-muted-foreground">
                      {item.overallSentimentScore >= 0 ? "+" : ""}{item.overallSentimentScore.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(item.analyzedAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this analysis?")) deleteMutation.mutate(item.id);
                  }}
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {historyQuery.data?.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No analyses yet. Enter a username above.</p>
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border bg-card">
          <div className="flex gap-2 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter a Twitter username (e.g. share_talk)"
                className="pl-9 h-10 bg-background"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                disabled={isLoading}
              />
            </div>
            <Button onClick={handleAnalyze} disabled={isLoading || !usernameInput.trim()} className="h-10 px-6">
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
              ) : (
                <><User className="w-4 h-4 mr-2" />Analyze</>
              )}
            </Button>
          </div>
          {analyzeMutation.isError && (
            <p className="text-sm text-destructive text-center mt-2">{analyzeMutation.error.message}</p>
          )}
        </div>

        <ScrollArea className="flex-1">
          {isLoading && <LoadingState />}
          {!isLoading && result && <AnalysisDashboard result={result} />}
          {!isLoading && !result && <EmptyState />}
        </ScrollArea>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Analyze a Twitter Account</h2>
        <p className="text-sm text-muted-foreground">
          Enter a username to get a comprehensive analysis of their Twitter activity, sentiment patterns, posting habits, and engagement metrics.
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
          <h3 className="text-lg font-medium mb-1">Analyzing account...</h3>
          <p className="text-sm text-muted-foreground">
            Fetching profile and tweets, running sentiment analysis, and generating insights. This may take 15-30 seconds.
          </p>
        </div>
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (<Skeleton key={i} className="h-28 rounded-xl" />))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

function AnalysisDashboard({ result }: { result: UserAnalysisResult }) {
  const profile = result.profileData;
  const sentimentPieData = [
    { name: "Positive", value: result.sentimentBreakdown.positive, color: SENTIMENT_COLORS.positive },
    { name: "Negative", value: result.sentimentBreakdown.negative, color: SENTIMENT_COLORS.negative },
    { name: "Neutral", value: result.sentimentBreakdown.neutral, color: SENTIMENT_COLORS.neutral },
  ];
  const engagementRate = profile.followersCount > 0
    ? ((result.averageEngagement / profile.followersCount) * 100).toFixed(2)
    : "0.00";
  const avgLikes = result.totalTweets > 0
    ? Math.round(result.tweets.reduce((s, t) => s + t.likes, 0) / result.totalTweets) : 0;
  const avgRetweets = result.totalTweets > 0
    ? Math.round(result.tweets.reduce((s, t) => s + t.retweets, 0) / result.totalTweets) : 0;

  return (
    <div className="p-6 space-y-6">
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            {profile.profileImageUrl ? (
              <img src={profile.profileImageUrl.replace("_normal", "_200x200")} alt="" className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-lg font-bold">
                {profile.name[0]}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <a href={`https://x.com/${profile.username}`} target="_blank" rel="noopener noreferrer"
                  className="text-lg font-bold hover:text-primary transition-colors flex items-center gap-1">
                  {profile.name} <ExternalLink className="w-3.5 h-3.5 opacity-50" />
                </a>
              </div>
              <a href={`https://x.com/${profile.username}`} target="_blank" rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-primary transition-colors">
                @{profile.username}
              </a>
              {profile.description && <p className="text-sm text-foreground/80 mt-2">{profile.description}</p>}
              <div className="flex items-center gap-5 mt-3 text-sm">
                <span><strong>{formatNumber(profile.followersCount)}</strong> <span className="text-muted-foreground">followers</span></span>
                <span><strong>{formatNumber(profile.followingCount)}</strong> <span className="text-muted-foreground">following</span></span>
                <span><strong>{formatNumber(profile.tweetCount)}</strong> <span className="text-muted-foreground">tweets</span></span>
                {profile.createdAt && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(result)}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Heart} label="Avg Likes" value={formatNumber(avgLikes)} subtext="per tweet" color="text-pink-400" />
        <StatCard icon={Repeat2} label="Avg Retweets" value={formatNumber(avgRetweets)} subtext="per tweet" color="text-green-400" />
        <StatCard icon={TrendingUp} label="Engagement Rate" value={`${engagementRate}%`} subtext="of followers" color="text-amber-400" />
        <StatCard icon={BarChart3} label="Sentiment Score"
          value={result.overallSentimentScore >= 0 ? `+${result.overallSentimentScore.toFixed(2)}` : result.overallSentimentScore.toFixed(2)}
          subtext={result.overallSentimentScore > 0.2 ? "positive" : result.overallSentimentScore < -0.2 ? "negative" : "neutral"}
          color={result.overallSentimentScore > 0.2 ? "text-green-400" : result.overallSentimentScore < -0.2 ? "text-red-400" : "text-gray-400"} />
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> AI Account Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{result.summary}</p>
          {result.keyThemes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {result.keyThemes.map((theme) => (<Badge key={theme} variant="secondary" className="text-xs">{theme}</Badge>))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">Sentiment Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={sentimentPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                    {sentimentPieData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
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
          <CardHeader className="pb-3"><CardTitle className="text-base">Tweet Volume Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={result.volumeOverTime}>
                <defs>
                  <linearGradient id="colorUserVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210 100% 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(210 100% 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="date" tick={TICK_STYLE} />
                <YAxis tick={TICK_STYLE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="count" stroke="hsl(210 100% 50%)" fill="url(#colorUserVolume)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> Posting by Day of Week</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={result.postingByDayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="day" tick={TICK_STYLE} />
                <YAxis tick={TICK_STYLE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="hsl(210 100% 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Posting by Hour (UTC)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={result.postingByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="hour" tick={TICK_STYLE} />
                <YAxis tick={TICK_STYLE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="hsl(262 83% 63%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Hash className="w-4 h-4" /> Top Hashtags Used</CardTitle>
          </CardHeader>
          <CardContent>
            {result.topHashtags.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(result.topHashtags.slice(0, 8).length * 32, 100)}>
                <BarChart data={result.topHashtags.slice(0, 8)} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis type="number" tick={TICK_STYLE} />
                  <YAxis dataKey="tag" type="category" tick={TICK_STYLE} width={60} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="hsl(210 100% 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (<p className="text-sm text-muted-foreground text-center py-6">No hashtags found</p>)}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><AtSign className="w-4 h-4" /> Top Mentions</CardTitle>
          </CardHeader>
          <CardContent>
            {result.topMentions.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(result.topMentions.slice(0, 8).length * 32, 100)}>
                <BarChart data={result.topMentions.slice(0, 8)} layout="vertical" margin={{ left: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                  <XAxis type="number" tick={TICK_STYLE} />
                  <YAxis dataKey="tag" type="category" tick={TICK_STYLE} width={70} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (<p className="text-sm text-muted-foreground text-center py-6">No mentions found</p>)}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Top Tweets by Engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Tweet</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Likes</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Retweets</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Replies</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Total</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Sentiment</th>
                </tr>
              </thead>
              <tbody>
                {result.topTweets.map((tweet) => (
                  <tr key={tweet.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                    <td className="py-2.5 max-w-xs">
                      <p className="text-sm truncate">{tweet.text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tweet.createdAt)}</p>
                    </td>
                    <td className="text-right text-muted-foreground">{formatNumber(tweet.likes)}</td>
                    <td className="text-right text-muted-foreground">{formatNumber(tweet.retweets)}</td>
                    <td className="text-right text-muted-foreground">{formatNumber(tweet.replies)}</td>
                    <td className="text-right font-medium">{formatNumber(tweet.totalEngagement)}</td>
                    <td className="text-right"><SentimentBadge sentiment={tweet.sentiment} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Tweet Feed ({result.tweets.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {result.tweets.map((tweet) => (
            <div key={tweet.id} className="p-3 rounded-lg hover:bg-accent/50 transition-colors border border-transparent hover:border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground/90 break-words">{tweet.text}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="w-3 h-3" /> {formatNumber(tweet.likes)}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Repeat2 className="w-3 h-3" /> {formatNumber(tweet.retweets)}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {formatNumber(tweet.replies)}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{formatDate(tweet.createdAt)}</span>
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

function StatCard({ icon: Icon, label, value, subtext, color }: {
  icon: React.ComponentType<{ className?: string }>;
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
