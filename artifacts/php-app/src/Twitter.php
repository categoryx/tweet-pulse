<?php

class TwitterClient {
    private string $bearerToken;

    public function __construct() {
        $token = getenv('TWITTER_BEARER_TOKEN');
        if (!$token) {
            throw new Exception('TWITTER_BEARER_TOKEN is not set');
        }
        $this->bearerToken = $token;
    }

    public function searchTweets(string $keyphrase, int $maxResults = 50): array {
        $maxResults = max(10, min($maxResults, 100));

        $params = http_build_query([
            'query' => "{$keyphrase} -is:retweet lang:en",
            'max_results' => $maxResults,
            'tweet.fields' => 'created_at,public_metrics,entities,author_id',
            'expansions' => 'author_id',
            'user.fields' => 'name,username,description,created_at,verified,public_metrics,profile_image_url',
        ]);

        $url = "https://api.twitter.com/2/tweets/search/recent?{$params}";
        $response = $this->apiRequest($url);

        $tweets = $response['data'] ?? [];
        $users = [];
        foreach (($response['includes']['users'] ?? []) as $user) {
            $users[$user['id']] = $user;
        }

        $results = [];
        foreach ($tweets as $tweet) {
            $authorId = $tweet['author_id'] ?? '';
            $author = $users[$authorId] ?? [
                'id' => $authorId,
                'name' => 'Unknown',
                'username' => 'unknown',
            ];
            $results[] = ['tweet' => $tweet, 'author' => $author];
        }

        return $results;
    }

    public function getUserByUsername(string $username): array {
        $username = ltrim($username, '@');
        $params = http_build_query([
            'user.fields' => 'name,username,description,created_at,verified,public_metrics,profile_image_url',
        ]);

        $url = "https://api.twitter.com/2/users/by/username/{$username}?{$params}";
        $response = $this->apiRequest($url);

        if (!isset($response['data'])) {
            $detail = $response['errors'][0]['detail'] ?? 'User not found';
            throw new Exception($detail);
        }

        return $response['data'];
    }

    public function getUserTweets(string $userId, int $maxResults = 100): array {
        $maxResults = max(5, min($maxResults, 100));

        $params = http_build_query([
            'max_results' => $maxResults,
            'tweet.fields' => 'created_at,public_metrics,entities,author_id',
            'exclude' => 'retweets',
        ]);

        $url = "https://api.twitter.com/2/users/{$userId}/tweets?{$params}";
        $response = $this->apiRequest($url);

        return $response['data'] ?? [];
    }

    private function apiRequest(string $url): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer {$this->bearerToken}",
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT => 30,
        ]);

        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            throw new Exception("Twitter API request failed: {$curlError}");
        }

        if ($httpCode !== 200) {
            throw new Exception("Twitter API error ({$httpCode}): {$body}");
        }

        return json_decode($body, true) ?? [];
    }
}
