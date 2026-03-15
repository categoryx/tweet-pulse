const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  created_at?: string;
  verified?: boolean;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  profile_image_url?: string;
}

export interface TwitterTweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  entities?: {
    hashtags?: Array<{ tag: string }>;
    mentions?: Array<{ username: string }>;
  };
}

interface TwitterSearchResponse {
  data?: TwitterTweet[];
  includes?: {
    users?: TwitterUser[];
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

interface TwitterUserLookupResponse {
  data?: TwitterUser;
  errors?: Array<{ detail: string }>;
}

interface TwitterUserTweetsResponse {
  data?: TwitterTweet[];
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

export interface RawTweetData {
  tweet: TwitterTweet;
  author: TwitterUser;
}

function ensureToken(): string {
  if (!TWITTER_BEARER_TOKEN) {
    throw new Error("TWITTER_BEARER_TOKEN is not set");
  }
  return TWITTER_BEARER_TOKEN;
}

export async function searchTweets(keyphrase: string, maxResults: number = 50): Promise<RawTweetData[]> {
  const token = ensureToken();

  const clampedMax = Math.min(Math.max(maxResults, 10), 100);

  const params = new URLSearchParams({
    query: `${keyphrase} -is:retweet lang:en`,
    max_results: String(clampedMax),
    "tweet.fields": "created_at,public_metrics,entities,author_id",
    "user.fields": "name,username,public_metrics,profile_image_url",
    expansions: "author_id",
  });

  const url = `https://api.twitter.com/2/tweets/search/recent?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twitter API error (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as TwitterSearchResponse;

  if (!json.data || json.data.length === 0) {
    return [];
  }

  const usersMap = new Map<string, TwitterUser>();
  if (json.includes?.users) {
    for (const user of json.includes.users) {
      usersMap.set(user.id, user);
    }
  }

  return json.data.map((tweet) => ({
    tweet,
    author: usersMap.get(tweet.author_id) || {
      id: tweet.author_id,
      name: "Unknown",
      username: "unknown",
    },
  }));
}

export async function getUserByUsername(username: string): Promise<TwitterUser> {
  const token = ensureToken();

  const cleanUsername = username.replace(/^@/, "");

  const params = new URLSearchParams({
    "user.fields": "name,username,description,created_at,verified,public_metrics,profile_image_url",
  });

  const url = `https://api.twitter.com/2/users/by/username/${cleanUsername}?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twitter API error (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as TwitterUserLookupResponse;

  if (!json.data) {
    const errMsg = json.errors?.[0]?.detail || "User not found";
    throw new Error(errMsg);
  }

  return json.data;
}

export async function getUserTweets(userId: string, maxResults: number = 100): Promise<TwitterTweet[]> {
  const token = ensureToken();

  const clampedMax = Math.min(Math.max(maxResults, 5), 100);

  const params = new URLSearchParams({
    max_results: String(clampedMax),
    "tweet.fields": "created_at,public_metrics,entities,author_id",
    exclude: "retweets",
  });

  const url = `https://api.twitter.com/2/users/${userId}/tweets?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twitter API error (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as TwitterUserTweetsResponse;

  return json.data || [];
}
