<?php

class Database {
    private static ?Database $instance = null;
    private PDO $pdo;
    private string $driver;

    private function __construct() {
        $mysqlHost = getenv('MYSQL_HOST');
        $mysqlUrl = getenv('MYSQL_URL');

        if ($mysqlHost || $mysqlUrl) {
            $this->driver = 'mysql';
            $this->connectMySQL($mysqlHost, $mysqlUrl);
        } else {
            $url = getenv('DATABASE_URL');
            if (!$url) {
                throw new Exception('No database configured. Set MYSQL_HOST/MYSQL_URL or DATABASE_URL.');
            }
            $this->driver = 'pgsql';
            $this->connectPostgreSQL($url);
        }

        $this->initSchema();
    }

    private function connectMySQL(?string $host, ?string $url): void {
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ];

        if ($url) {
            $parsed = parse_url($url);
            $h = $parsed['host'] ?? 'localhost';
            $port = $parsed['port'] ?? 3306;
            $dbname = ltrim($parsed['path'] ?? '/tweetpulse', '/');
            $user = $parsed['user'] ?? 'root';
            $pass = $parsed['pass'] ?? '';
        } else {
            $h = $host;
            $port = getenv('MYSQL_PORT') ?: '3306';
            $dbname = getenv('MYSQL_DATABASE') ?: 'tweetpulse';
            $user = getenv('MYSQL_USER') ?: 'root';
            $pass = getenv('MYSQL_PASSWORD') ?: '';
        }

        $dsn = "mysql:host={$h};port={$port};dbname={$dbname};charset=utf8mb4";
        $this->pdo = new PDO($dsn, $user, $pass, $options);
    }

    private function connectPostgreSQL(string $url): void {
        $parsed = parse_url($url);
        $host = $parsed['host'] ?? 'localhost';
        $port = $parsed['port'] ?? 5432;
        $dbname = ltrim($parsed['path'] ?? '/postgres', '/');
        $user = $parsed['user'] ?? 'postgres';
        $pass = $parsed['pass'] ?? '';

        $dsn = "pgsql:host={$host};port={$port};dbname={$dbname}";

        $query = [];
        if (!empty($parsed['query'])) {
            parse_str($parsed['query'], $query);
        }
        if (($query['sslmode'] ?? '') === 'disable') {
            $dsn .= ';sslmode=disable';
        }

        $this->pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    public static function getInstance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getDriver(): string {
        return $this->driver;
    }

    private function initSchema(): void {
        if ($this->driver === 'mysql') {
            $this->initMySQL();
        } else {
            $this->initPostgreSQL();
        }
    }

    private function initMySQL(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS searches (
                id INT AUTO_INCREMENT PRIMARY KEY,
                keyphrase TEXT NOT NULL,
                total_tweets INT NOT NULL,
                average_engagement FLOAT NOT NULL,
                overall_sentiment_score FLOAT NOT NULL,
                summary TEXT NOT NULL,
                key_themes JSON NOT NULL,
                sentiment_breakdown JSON NOT NULL,
                top_sources JSON NOT NULL,
                top_hashtags JSON NOT NULL,
                top_mentions JSON NOT NULL,
                volume_over_time JSON NOT NULL,
                tweets JSON NOT NULL,
                searched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS user_analyses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username TEXT NOT NULL,
                profile_data JSON NOT NULL,
                total_tweets INT NOT NULL,
                average_engagement FLOAT NOT NULL,
                overall_sentiment_score FLOAT NOT NULL,
                summary TEXT NOT NULL,
                key_themes JSON NOT NULL,
                sentiment_breakdown JSON NOT NULL,
                top_hashtags JSON NOT NULL,
                top_mentions JSON NOT NULL,
                volume_over_time JSON NOT NULL,
                posting_by_day_of_week JSON NOT NULL,
                posting_by_hour JSON NOT NULL,
                top_tweets JSON NOT NULL,
                tweets JSON NOT NULL,
                analyzed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    private function initPostgreSQL(): void {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS searches (
                id SERIAL PRIMARY KEY,
                keyphrase TEXT NOT NULL,
                total_tweets INTEGER NOT NULL,
                average_engagement REAL NOT NULL,
                overall_sentiment_score REAL NOT NULL,
                summary TEXT NOT NULL,
                key_themes JSONB NOT NULL DEFAULT '[]',
                sentiment_breakdown JSONB NOT NULL DEFAULT '{}',
                top_sources JSONB NOT NULL DEFAULT '[]',
                top_hashtags JSONB NOT NULL DEFAULT '[]',
                top_mentions JSONB NOT NULL DEFAULT '[]',
                volume_over_time JSONB NOT NULL DEFAULT '[]',
                tweets JSONB NOT NULL DEFAULT '[]',
                searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        ");

        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS user_analyses (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                profile_data JSONB NOT NULL DEFAULT '{}',
                total_tweets INTEGER NOT NULL,
                average_engagement REAL NOT NULL,
                overall_sentiment_score REAL NOT NULL,
                summary TEXT NOT NULL,
                key_themes JSONB NOT NULL DEFAULT '[]',
                sentiment_breakdown JSONB NOT NULL DEFAULT '{}',
                top_hashtags JSONB NOT NULL DEFAULT '[]',
                top_mentions JSONB NOT NULL DEFAULT '[]',
                volume_over_time JSONB NOT NULL DEFAULT '[]',
                posting_by_day_of_week JSONB NOT NULL DEFAULT '[]',
                posting_by_hour JSONB NOT NULL DEFAULT '[]',
                top_tweets JSONB NOT NULL DEFAULT '[]',
                tweets JSONB NOT NULL DEFAULT '[]',
                analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        ");
    }

    public function getSearchHistory(): array {
        $stmt = $this->pdo->query("SELECT id, keyphrase, total_tweets, overall_sentiment_score, searched_at FROM searches ORDER BY searched_at DESC");
        return $stmt->fetchAll();
    }

    public function getSearch(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM searches WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return null;
        return $this->decodeSearchRow($row);
    }

    public function insertSearch(array $data): int {
        $stmt = $this->pdo->prepare("
            INSERT INTO searches (keyphrase, total_tweets, average_engagement, overall_sentiment_score, summary, key_themes, sentiment_breakdown, top_sources, top_hashtags, top_mentions, volume_over_time, tweets)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['keyphrase'],
            $data['totalTweets'],
            $data['averageEngagement'],
            $data['overallSentimentScore'],
            $data['summary'],
            json_encode($data['keyThemes']),
            json_encode($data['sentimentBreakdown']),
            json_encode($data['topSources']),
            json_encode($data['topHashtags']),
            json_encode($data['topMentions']),
            json_encode($data['volumeOverTime']),
            json_encode($data['tweets']),
        ]);
        return (int)$this->pdo->lastInsertId();
    }

    public function deleteSearch(int $id): void {
        $stmt = $this->pdo->prepare("DELETE FROM searches WHERE id = ?");
        $stmt->execute([$id]);
    }

    public function getUserAnalysisHistory(): array {
        $stmt = $this->pdo->query("SELECT id, username, total_tweets, overall_sentiment_score, analyzed_at FROM user_analyses ORDER BY analyzed_at DESC");
        return $stmt->fetchAll();
    }

    public function getUserAnalysis(int $id): ?array {
        $stmt = $this->pdo->prepare("SELECT * FROM user_analyses WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) return null;
        return $this->decodeUserAnalysisRow($row);
    }

    public function insertUserAnalysis(array $data): int {
        $stmt = $this->pdo->prepare("
            INSERT INTO user_analyses (username, profile_data, total_tweets, average_engagement, overall_sentiment_score, summary, key_themes, sentiment_breakdown, top_hashtags, top_mentions, volume_over_time, posting_by_day_of_week, posting_by_hour, top_tweets, tweets)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['username'],
            json_encode($data['profileData']),
            $data['totalTweets'],
            $data['averageEngagement'],
            $data['overallSentimentScore'],
            $data['summary'],
            json_encode($data['keyThemes']),
            json_encode($data['sentimentBreakdown']),
            json_encode($data['topHashtags']),
            json_encode($data['topMentions']),
            json_encode($data['volumeOverTime']),
            json_encode($data['postingByDayOfWeek']),
            json_encode($data['postingByHour']),
            json_encode($data['topTweets']),
            json_encode($data['tweets']),
        ]);
        return (int)$this->pdo->lastInsertId();
    }

    public function deleteUserAnalysis(int $id): void {
        $stmt = $this->pdo->prepare("DELETE FROM user_analyses WHERE id = ?");
        $stmt->execute([$id]);
    }

    private function decodeSearchRow(array $row): array {
        return [
            'id' => (int)$row['id'],
            'keyphrase' => $row['keyphrase'],
            'totalTweets' => (int)$row['total_tweets'],
            'averageEngagement' => (float)$row['average_engagement'],
            'overallSentimentScore' => (float)$row['overall_sentiment_score'],
            'summary' => $row['summary'],
            'keyThemes' => json_decode($row['key_themes'], true),
            'sentimentBreakdown' => json_decode($row['sentiment_breakdown'], true),
            'topSources' => json_decode($row['top_sources'], true),
            'topHashtags' => json_decode($row['top_hashtags'], true),
            'topMentions' => json_decode($row['top_mentions'], true),
            'volumeOverTime' => json_decode($row['volume_over_time'], true),
            'tweets' => json_decode($row['tweets'], true),
            'searchedAt' => $row['searched_at'],
        ];
    }

    private function decodeUserAnalysisRow(array $row): array {
        return [
            'id' => (int)$row['id'],
            'username' => $row['username'],
            'profileData' => json_decode($row['profile_data'], true),
            'totalTweets' => (int)$row['total_tweets'],
            'averageEngagement' => (float)$row['average_engagement'],
            'overallSentimentScore' => (float)$row['overall_sentiment_score'],
            'summary' => $row['summary'],
            'keyThemes' => json_decode($row['key_themes'], true),
            'sentimentBreakdown' => json_decode($row['sentiment_breakdown'], true),
            'topHashtags' => json_decode($row['top_hashtags'], true),
            'topMentions' => json_decode($row['top_mentions'], true),
            'volumeOverTime' => json_decode($row['volume_over_time'], true),
            'postingByDayOfWeek' => json_decode($row['posting_by_day_of_week'], true),
            'postingByHour' => json_decode($row['posting_by_hour'], true),
            'topTweets' => json_decode($row['top_tweets'], true),
            'tweets' => json_decode($row['tweets'], true),
            'analyzedAt' => $row['analyzed_at'],
        ];
    }
}
