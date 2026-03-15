<?php

class OpenAIClient {
    private string $baseUrl;
    private string $apiKey;

    public function __construct() {
        $this->baseUrl = rtrim(getenv('AI_INTEGRATIONS_OPENAI_BASE_URL') ?: 'https://api.openai.com/v1', '/');
        $this->apiKey = getenv('AI_INTEGRATIONS_OPENAI_API_KEY') ?: '';
        if (empty($this->apiKey)) {
            throw new Exception('AI_INTEGRATIONS_OPENAI_API_KEY is not set');
        }
    }

    public function analyzeSentimentBatch(array $tweets): array {
        $results = [];
        $chunks = array_chunk($tweets, 5);

        foreach ($chunks as $chunk) {
            $handles = [];
            $mh = curl_multi_init();

            foreach ($chunk as $tweet) {
                $payload = json_encode([
                    'model' => 'gpt-4o-mini',
                    'max_tokens' => 100,
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You are a sentiment analyzer. Classify the tweet as "positive", "negative", or "neutral". Return ONLY a JSON object: {"sentiment":"positive"|"negative"|"neutral","score":number} where score is -1.0 (most negative) to 1.0 (most positive). No other text.',
                        ],
                        ['role' => 'user', 'content' => $tweet['text']],
                    ],
                ]);

                $ch = curl_init("{$this->baseUrl}/chat/completions");
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => $payload,
                    CURLOPT_HTTPHEADER => [
                        "Authorization: Bearer {$this->apiKey}",
                        'Content-Type: application/json',
                    ],
                    CURLOPT_TIMEOUT => 30,
                ]);

                curl_multi_add_handle($mh, $ch);
                $handles[$tweet['id']] = $ch;
            }

            do {
                $status = curl_multi_exec($mh, $active);
                if ($active) {
                    curl_multi_select($mh);
                }
            } while ($active && $status === CURLM_OK);

            foreach ($handles as $tweetId => $ch) {
                $body = curl_multi_getcontent($ch);
                curl_multi_remove_handle($mh, $ch);
                curl_close($ch);

                try {
                    $resp = json_decode($body, true);
                    $content = $resp['choices'][0]['message']['content'] ?? '';
                    $content = preg_replace('/```json\s*/', '', $content);
                    $content = preg_replace('/```/', '', $content);
                    $parsed = json_decode(trim($content), true);
                    $results[$tweetId] = [
                        'sentiment' => $parsed['sentiment'] ?? 'neutral',
                        'score' => (float)($parsed['score'] ?? 0),
                    ];
                } catch (Exception $e) {
                    $results[$tweetId] = ['sentiment' => 'neutral', 'score' => 0];
                }
            }

            curl_multi_close($mh);
        }

        return $results;
    }

    public function generateSummary(string $keyphrase, array $tweets, array $sentiments): array {
        $breakdown = ['positive' => 0, 'negative' => 0, 'neutral' => 0];
        foreach ($sentiments as $s) {
            $breakdown[$s['sentiment']]++;
        }

        $sampleTweets = array_slice($tweets, 0, 30);
        $tweetLines = implode("\n", array_map(function($t) use ($sentiments) {
            $sent = $sentiments[$t['id']]['sentiment'] ?? 'neutral';
            return "[{$sent}] {$t['text']}";
        }, $sampleTweets));

        $prompt = "Keyphrase: \"{$keyphrase}\"\nSentiment: {$breakdown['positive']} positive, {$breakdown['negative']} negative, {$breakdown['neutral']} neutral\nSample tweets:\n{$tweetLines}";

        return $this->chatCompletion(
            'You analyze Twitter search results. Return ONLY a JSON object with: {"summary": "2-3 paragraph analysis of the conversation", "keyThemes": ["theme1", "theme2", ...]} (max 6 themes). Focus on main talking points, sentiment drivers, and notable patterns.',
            $prompt
        );
    }

    public function generateUserSummary(string $username, array $profile, array $tweets, array $sentiments): array {
        $breakdown = ['positive' => 0, 'negative' => 0, 'neutral' => 0];
        foreach ($sentiments as $s) {
            $breakdown[$s['sentiment']]++;
        }

        $sampleTweets = array_slice($tweets, 0, 30);
        $tweetLines = implode("\n", array_map(function($t) use ($sentiments) {
            $sent = $sentiments[$t['id']]['sentiment'] ?? 'neutral';
            return "[{$sent}] {$t['text']}";
        }, $sampleTweets));

        $prompt = "User: @{$username} ({$profile['name']})\nBio: " . ($profile['description'] ?? 'No bio') .
            "\nStats: " . ($profile['public_metrics']['followers_count'] ?? 0) . " followers, " .
            ($profile['public_metrics']['following_count'] ?? 0) . " following, " .
            ($profile['public_metrics']['tweet_count'] ?? 0) . " total tweets" .
            "\nSentiment: {$breakdown['positive']} positive, {$breakdown['negative']} negative, {$breakdown['neutral']} neutral" .
            "\nSample tweets:\n{$tweetLines}";

        return $this->chatCompletion(
            'You analyze Twitter user accounts. Return ONLY a JSON object with: {"summary": "2-3 paragraph personality and communication style analysis", "keyThemes": ["theme1", "theme2", ...]} (max 6 themes). Focus on their writing style, topics they care about, tone, and engagement patterns. Be specific and insightful.',
            $prompt
        );
    }

    private function chatCompletion(string $systemPrompt, string $userPrompt): array {
        $payload = json_encode([
            'model' => 'gpt-4o-mini',
            'max_tokens' => 1024,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt],
            ],
        ]);

        $ch = curl_init("{$this->baseUrl}/chat/completions");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer {$this->apiKey}",
                'Content-Type: application/json',
            ],
            CURLOPT_TIMEOUT => 60,
        ]);

        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("OpenAI API error ({$httpCode}): {$body}");
            return ['summary' => 'Unable to generate summary.', 'keyThemes' => []];
        }

        try {
            $resp = json_decode($body, true);
            $content = $resp['choices'][0]['message']['content'] ?? '';
            $content = preg_replace('/```json\s*/', '', $content);
            $content = preg_replace('/```/', '', $content);
            return json_decode(trim($content), true) ?: ['summary' => 'Unable to parse summary.', 'keyThemes' => []];
        } catch (Exception $e) {
            return ['summary' => 'Unable to generate summary.', 'keyThemes' => []];
        }
    }
}
