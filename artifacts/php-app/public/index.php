<?php
error_reporting(E_ALL);
ini_set('display_errors', '0');

$basePath = rtrim(getenv('BASE_PATH') ?: '/php-app', '/');

require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Twitter.php';
require_once __DIR__ . '/../src/OpenAI.php';

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (strpos($uri, $basePath) === 0) {
    $route = substr($uri, strlen($basePath)) ?: '/';
} else {
    $route = $uri;
}

$route = rtrim($route, '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'];

header('Content-Type: text/html; charset=utf-8');

try {
    if ($method === 'GET' && $route === '/') {
        handleSearchPage();
    } elseif ($method === 'POST' && $route === '/search') {
        handleSearchAction();
    } elseif ($method === 'GET' && preg_match('#^/search/(\d+)$#', $route, $m)) {
        handleSearchResult((int)$m[1]);
    } elseif ($method === 'GET' && $route === '/user-analysis') {
        handleUserAnalysisPage();
    } elseif ($method === 'POST' && $route === '/user-analysis') {
        handleUserAnalysisAction();
    } elseif ($method === 'GET' && preg_match('#^/user-analysis/(\d+)$#', $route, $m)) {
        handleUserAnalysisResult((int)$m[1]);
    } elseif ($method === 'GET' && $route === '/api/searches') {
        header('Content-Type: application/json');
        echo json_encode(Database::getInstance()->getSearchHistory());
    } elseif ($method === 'GET' && $route === '/api/user-analyses') {
        header('Content-Type: application/json');
        echo json_encode(Database::getInstance()->getUserAnalysisHistory());
    } elseif ($method === 'DELETE' && preg_match('#^/api/searches/(\d+)$#', $route, $m)) {
        header('Content-Type: application/json');
        handleDeleteSearch((int)$m[1]);
    } elseif ($method === 'DELETE' && preg_match('#^/api/user-analyses/(\d+)$#', $route, $m)) {
        header('Content-Type: application/json');
        handleDeleteUserAnalysis((int)$m[1]);
    } elseif ($method === 'GET' && $route === '/api/healthz') {
        header('Content-Type: application/json');
        echo json_encode(['status' => 'ok']);
    } else {
        http_response_code(404);
        echo '<h1>404 Not Found</h1>';
    }
} catch (Exception $e) {
    http_response_code(500);
    error_log('App error: ' . $e->getMessage());
    echo '<h1>500 Internal Server Error</h1><p>' . htmlspecialchars($e->getMessage()) . '</p>';
}

function basePath(): string {
    return rtrim(getenv('BASE_PATH') ?: '/php-app', '/');
}

function url(string $path): string {
    return basePath() . $path;
}

function handleSearchPage(): void {
    $db = Database::getInstance();
    $searches = $db->getSearchHistory();
    $result = null;
    $error = null;
    include __DIR__ . '/../templates/layout.php';
}

function handleSearchAction(): void {
    $keyphrase = trim($_POST['keyphrase'] ?? '');
    if (empty($keyphrase)) {
        header('Location: ' . url('/'));
        exit;
    }

    $db = Database::getInstance();
    $twitter = new TwitterClient();
    $ai = new OpenAIClient();

    try {
        $rawTweets = $twitter->searchTweets($keyphrase, 50);

        if (empty($rawTweets)) {
            $error = "No tweets found for '{$keyphrase}'.";
            $searches = $db->getSearchHistory();
            $result = null;
            include __DIR__ . '/../templates/layout.php';
            return;
        }

        $tweetTexts = array_map(function($t) {
            return ['id' => $t['tweet']['id'], 'text' => $t['tweet']['text']];
        }, $rawTweets);

        $sentiments = $ai->analyzeSentimentBatch($tweetTexts);
        $summary = $ai->generateSummary($keyphrase, $tweetTexts, $sentiments);

        $aggregated = aggregateSearchData($rawTweets, $sentiments, $summary, $keyphrase);
        $id = $db->insertSearch($aggregated);

        header('Location: ' . url("/search/{$id}"));
        exit;
    } catch (Exception $e) {
        $error = $e->getMessage();
        $searches = $db->getSearchHistory();
        $result = null;
        include __DIR__ . '/../templates/layout.php';
    }
}

function handleSearchResult(int $id): void {
    $db = Database::getInstance();
    $result = $db->getSearch($id);
    if (!$result) {
        http_response_code(404);
        echo '<h1>Search not found</h1>';
        return;
    }
    $searches = $db->getSearchHistory();
    $error = null;
    include __DIR__ . '/../templates/layout.php';
}

function handleDeleteSearch(int $id): void {
    $db = Database::getInstance();
    $db->deleteSearch($id);
    echo json_encode(['success' => true]);
}

function handleDeleteUserAnalysis(int $id): void {
    $db = Database::getInstance();
    $db->deleteUserAnalysis($id);
    echo json_encode(['success' => true]);
}

function handleUserAnalysisPage(): void {
    $db = Database::getInstance();
    $analyses = $db->getUserAnalysisHistory();
    $result = null;
    $error = null;
    include __DIR__ . '/../templates/user-analysis-layout.php';
}

function handleUserAnalysisAction(): void {
    $username = trim($_POST['username'] ?? '');
    if (empty($username)) {
        header('Location: ' . url('/user-analysis'));
        exit;
    }

    $username = ltrim($username, '@');
    $db = Database::getInstance();
    $twitter = new TwitterClient();
    $ai = new OpenAIClient();

    try {
        $profile = $twitter->getUserByUsername($username);
        $tweets = $twitter->getUserTweets($profile['id'], 100);

        if (empty($tweets)) {
            $error = "No tweets found for @{$username}.";
            $analyses = $db->getUserAnalysisHistory();
            $result = null;
            include __DIR__ . '/../templates/user-analysis-layout.php';
            return;
        }

        $tweetTexts = array_map(function($t) {
            return ['id' => $t['id'], 'text' => $t['text']];
        }, $tweets);

        $sentiments = $ai->analyzeSentimentBatch($tweetTexts);
        $summaryData = $ai->generateUserSummary($username, $profile, $tweetTexts, $sentiments);

        $aggregated = aggregateUserData($profile, $tweets, $sentiments, $summaryData);
        $id = $db->insertUserAnalysis($aggregated);

        header('Location: ' . url("/user-analysis/{$id}"));
        exit;
    } catch (Exception $e) {
        $error = $e->getMessage();
        $analyses = $db->getUserAnalysisHistory();
        $result = null;
        include __DIR__ . '/../templates/user-analysis-layout.php';
    }
}

function handleUserAnalysisResult(int $id): void {
    $db = Database::getInstance();
    $result = $db->getUserAnalysis($id);
    if (!$result) {
        http_response_code(404);
        echo '<h1>Analysis not found</h1>';
        return;
    }
    $analyses = $db->getUserAnalysisHistory();
    $error = null;
    include __DIR__ . '/../templates/user-analysis-layout.php';
}

function aggregateSearchData(array $rawTweets, array $sentiments, array $summary, string $keyphrase): array {
    $totalEngagement = 0;
    $sentimentBreakdown = ['positive' => 0, 'negative' => 0, 'neutral' => 0];
    $hashtagCounts = [];
    $mentionCounts = [];
    $volumeByDate = [];
    $authorStats = [];
    $processedTweets = [];

    foreach ($rawTweets as $item) {
        $tweet = $item['tweet'];
        $author = $item['author'];
        $tweetId = $tweet['id'];
        $metrics = $tweet['public_metrics'] ?? ['like_count' => 0, 'retweet_count' => 0, 'reply_count' => 0, 'quote_count' => 0];
        $engagement = ($metrics['like_count'] ?? 0) + ($metrics['retweet_count'] ?? 0) + ($metrics['reply_count'] ?? 0);
        $totalEngagement += $engagement;

        $sent = $sentiments[$tweetId] ?? ['sentiment' => 'neutral', 'score' => 0];
        $sentimentBreakdown[$sent['sentiment']]++;

        $date = substr($tweet['created_at'] ?? date('Y-m-d'), 0, 10);
        $volumeByDate[$date] = ($volumeByDate[$date] ?? 0) + 1;

        if (!empty($tweet['entities']['hashtags'])) {
            foreach ($tweet['entities']['hashtags'] as $h) {
                $tag = strtolower($h['tag']);
                $hashtagCounts[$tag] = ($hashtagCounts[$tag] ?? 0) + 1;
            }
        }
        if (!empty($tweet['entities']['mentions'])) {
            foreach ($tweet['entities']['mentions'] as $m) {
                $mentionCounts[$m['username']] = ($mentionCounts[$m['username']] ?? 0) + 1;
            }
        }

        $authorId = $author['username'];
        if (!isset($authorStats[$authorId])) {
            $authorStats[$authorId] = [
                'username' => $author['username'],
                'name' => $author['name'],
                'profileImageUrl' => $author['profile_image_url'] ?? null,
                'tweetCount' => 0,
                'followers' => $author['public_metrics']['followers_count'] ?? 0,
                'totalEngagement' => 0,
                'sentimentSum' => 0,
            ];
        }
        $authorStats[$authorId]['tweetCount']++;
        $authorStats[$authorId]['totalEngagement'] += $engagement;
        $authorStats[$authorId]['sentimentSum'] += $sent['score'];

        $processedTweets[] = [
            'id' => $tweetId,
            'text' => $tweet['text'],
            'authorUsername' => $author['username'],
            'authorName' => $author['name'],
            'authorProfileImageUrl' => $author['profile_image_url'] ?? null,
            'authorFollowers' => $author['public_metrics']['followers_count'] ?? 0,
            'sentiment' => $sent['sentiment'],
            'sentimentScore' => $sent['score'],
            'likes' => $metrics['like_count'] ?? 0,
            'retweets' => $metrics['retweet_count'] ?? 0,
            'replies' => $metrics['reply_count'] ?? 0,
            'createdAt' => $tweet['created_at'] ?? '',
        ];
    }

    $total = count($rawTweets);
    $sentimentBreakdown['positivePercent'] = $total > 0 ? round(($sentimentBreakdown['positive'] / $total) * 100, 1) : 0;
    $sentimentBreakdown['negativePercent'] = $total > 0 ? round(($sentimentBreakdown['negative'] / $total) * 100, 1) : 0;
    $sentimentBreakdown['neutralPercent'] = $total > 0 ? round(($sentimentBreakdown['neutral'] / $total) * 100, 1) : 0;

    arsort($hashtagCounts);
    arsort($mentionCounts);
    ksort($volumeByDate);

    $topSources = array_values($authorStats);
    usort($topSources, function($a, $b) { return $b['totalEngagement'] - $a['totalEngagement']; });
    $topSources = array_slice($topSources, 0, 10);
    foreach ($topSources as &$s) {
        $s['averageSentiment'] = $s['tweetCount'] > 0 ? round($s['sentimentSum'] / $s['tweetCount'], 2) : 0;
        unset($s['sentimentSum']);
    }

    $topHashtags = [];
    $i = 0;
    foreach ($hashtagCounts as $tag => $count) {
        if ($i++ >= 10) break;
        $topHashtags[] = ['tag' => $tag, 'count' => $count];
    }

    $topMentions = [];
    $i = 0;
    foreach ($mentionCounts as $tag => $count) {
        if ($i++ >= 10) break;
        $topMentions[] = ['tag' => $tag, 'count' => $count];
    }

    $volumeOverTime = [];
    foreach ($volumeByDate as $date => $count) {
        $volumeOverTime[] = ['date' => $date, 'count' => $count];
    }

    $avgSentiment = 0;
    foreach ($sentiments as $s) {
        $avgSentiment += $s['score'];
    }
    $avgSentiment = $total > 0 ? round($avgSentiment / $total, 3) : 0;

    return [
        'keyphrase' => $keyphrase,
        'totalTweets' => $total,
        'averageEngagement' => $total > 0 ? round($totalEngagement / $total, 1) : 0,
        'overallSentimentScore' => $avgSentiment,
        'summary' => $summary['summary'],
        'keyThemes' => $summary['keyThemes'],
        'sentimentBreakdown' => $sentimentBreakdown,
        'topSources' => $topSources,
        'topHashtags' => $topHashtags,
        'topMentions' => $topMentions,
        'volumeOverTime' => $volumeOverTime,
        'tweets' => $processedTweets,
    ];
}

function aggregateUserData(array $profile, array $tweets, array $sentiments, array $summaryData): array {
    $sentimentBreakdown = ['positive' => 0, 'negative' => 0, 'neutral' => 0];
    $hashtagCounts = [];
    $mentionCounts = [];
    $volumeByDate = [];
    $dayOfWeek = [0,0,0,0,0,0,0];
    $hourCounts = array_fill(0, 24, 0);
    $totalLikes = 0;
    $totalRetweets = 0;
    $totalReplies = 0;
    $processedTweets = [];
    $topTweets = [];

    foreach ($tweets as $tweet) {
        $tweetId = $tweet['id'];
        $metrics = $tweet['public_metrics'] ?? ['like_count' => 0, 'retweet_count' => 0, 'reply_count' => 0, 'quote_count' => 0];
        $likes = $metrics['like_count'] ?? 0;
        $retweets = $metrics['retweet_count'] ?? 0;
        $replies = $metrics['reply_count'] ?? 0;
        $engagement = $likes + $retweets + $replies;
        $totalLikes += $likes;
        $totalRetweets += $retweets;
        $totalReplies += $replies;

        $sent = $sentiments[$tweetId] ?? ['sentiment' => 'neutral', 'score' => 0];
        $sentimentBreakdown[$sent['sentiment']]++;

        $createdAt = $tweet['created_at'] ?? date('c');
        $date = substr($createdAt, 0, 10);
        $volumeByDate[$date] = ($volumeByDate[$date] ?? 0) + 1;

        $ts = strtotime($createdAt);
        $dow = ((int)date('N', $ts) - 1); // 0=Mon, 6=Sun
        $dayOfWeek[$dow]++;
        $hourCounts[(int)date('G', $ts)]++;

        if (!empty($tweet['entities']['hashtags'])) {
            foreach ($tweet['entities']['hashtags'] as $h) {
                $tag = strtolower($h['tag']);
                $hashtagCounts[$tag] = ($hashtagCounts[$tag] ?? 0) + 1;
            }
        }
        if (!empty($tweet['entities']['mentions'])) {
            foreach ($tweet['entities']['mentions'] as $m) {
                $mentionCounts[$m['username']] = ($mentionCounts[$m['username']] ?? 0) + 1;
            }
        }

        $processedTweets[] = [
            'id' => $tweetId,
            'text' => $tweet['text'],
            'sentiment' => $sent['sentiment'],
            'sentimentScore' => $sent['score'],
            'likes' => $likes,
            'retweets' => $retweets,
            'replies' => $replies,
            'createdAt' => $createdAt,
        ];

        $topTweets[] = [
            'id' => $tweetId,
            'text' => $tweet['text'],
            'likes' => $likes,
            'retweets' => $retweets,
            'replies' => $replies,
            'totalEngagement' => $engagement,
            'sentiment' => $sent['sentiment'],
            'sentimentScore' => $sent['score'],
            'createdAt' => $createdAt,
        ];
    }

    usort($topTweets, function($a, $b) { return $b['totalEngagement'] - $a['totalEngagement']; });
    $topTweets = array_slice($topTweets, 0, 5);

    $total = count($tweets);
    $sentimentBreakdown['positivePercent'] = $total > 0 ? round(($sentimentBreakdown['positive'] / $total) * 100, 1) : 0;
    $sentimentBreakdown['negativePercent'] = $total > 0 ? round(($sentimentBreakdown['negative'] / $total) * 100, 1) : 0;
    $sentimentBreakdown['neutralPercent'] = $total > 0 ? round(($sentimentBreakdown['neutral'] / $total) * 100, 1) : 0;

    arsort($hashtagCounts);
    arsort($mentionCounts);
    ksort($volumeByDate);

    $topHashtags = [];
    $i = 0;
    foreach ($hashtagCounts as $tag => $count) {
        if ($i++ >= 10) break;
        $topHashtags[] = ['tag' => $tag, 'count' => $count];
    }

    $topMentions = [];
    $i = 0;
    foreach ($mentionCounts as $tag => $count) {
        if ($i++ >= 10) break;
        $topMentions[] = ['tag' => $tag, 'count' => $count];
    }

    $volumeOverTime = [];
    foreach ($volumeByDate as $date => $count) {
        $volumeOverTime[] = ['date' => $date, 'count' => $count];
    }

    $dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    $postingByDayOfWeek = [];
    for ($i = 0; $i < 7; $i++) {
        $postingByDayOfWeek[] = ['day' => $dayNames[$i], 'count' => $dayOfWeek[$i]];
    }

    $postingByHour = [];
    for ($i = 0; $i < 24; $i++) {
        $postingByHour[] = ['hour' => $i, 'count' => $hourCounts[$i]];
    }

    $avgSentiment = 0;
    foreach ($sentiments as $s) {
        $avgSentiment += $s['score'];
    }
    $avgSentiment = $total > 0 ? round($avgSentiment / $total, 3) : 0;

    $avgEngagement = $total > 0 ? round(($totalLikes + $totalRetweets + $totalReplies) / $total, 1) : 0;

    return [
        'username' => $profile['username'],
        'profileData' => [
            'id' => $profile['id'],
            'name' => $profile['name'],
            'username' => $profile['username'],
            'description' => $profile['description'] ?? null,
            'createdAt' => $profile['created_at'] ?? null,
            'verified' => $profile['verified'] ?? false,
            'profileImageUrl' => $profile['profile_image_url'] ?? null,
            'followersCount' => $profile['public_metrics']['followers_count'] ?? 0,
            'followingCount' => $profile['public_metrics']['following_count'] ?? 0,
            'tweetCount' => $profile['public_metrics']['tweet_count'] ?? 0,
            'listedCount' => $profile['public_metrics']['listed_count'] ?? 0,
        ],
        'totalTweets' => $total,
        'averageEngagement' => $avgEngagement,
        'overallSentimentScore' => $avgSentiment,
        'summary' => $summaryData['summary'],
        'keyThemes' => $summaryData['keyThemes'],
        'sentimentBreakdown' => $sentimentBreakdown,
        'topHashtags' => $topHashtags,
        'topMentions' => $topMentions,
        'volumeOverTime' => $volumeOverTime,
        'postingByDayOfWeek' => $postingByDayOfWeek,
        'postingByHour' => $postingByHour,
        'topTweets' => $topTweets,
        'tweets' => $processedTweets,
        'avgLikes' => $total > 0 ? round($totalLikes / $total, 1) : 0,
        'avgRetweets' => $total > 0 ? round($totalRetweets / $total, 1) : 0,
        'avgReplies' => $total > 0 ? round($totalReplies / $total, 1) : 0,
    ];
}
