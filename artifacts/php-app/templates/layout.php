<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tweet Pulse - Keyword Search</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: { sans: ['Inter', 'sans-serif'] },
                    colors: {
                        dark: { 900: '#0f1117', 800: '#1a1d27', 700: '#252833', 600: '#353849' },
                    }
                }
            }
        }
    </script>
    <style>
        body { font-family: 'Inter', sans-serif; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #353849; border-radius: 2px; }
        .spinner { border: 3px solid #353849; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 0.8s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .history-item:hover .delete-btn { opacity: 1; }
        .delete-btn { opacity: 0; transition: opacity 0.15s; }
    </style>
</head>
<body class="dark bg-dark-900 text-gray-100 min-h-screen flex flex-col">
    <nav class="bg-dark-800 border-b border-dark-600 px-6 py-3">
        <div class="flex items-center justify-between max-w-screen-2xl mx-auto">
            <div class="flex items-center gap-2">
                <svg class="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"/></svg>
                <span class="text-lg font-bold text-white">Tweet Pulse</span>
            </div>
            <div class="flex gap-1">
                <a href="<?= url('/') ?>" class="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white">Keyword Search</a>
                <a href="<?= url('/user-analysis') ?>" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-dark-700 transition-colors">User Analysis</a>
            </div>
        </div>
    </nav>

    <div class="flex flex-1 overflow-hidden">
        <aside class="w-72 bg-dark-800 border-r border-dark-600 flex flex-col">
            <div class="p-4 border-b border-dark-600">
                <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Search History</h2>
            </div>
            <div class="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1" id="history-list">
                <?php if (empty($searches)): ?>
                    <p class="text-sm text-gray-500 p-3">No searches yet</p>
                <?php else: ?>
                    <?php foreach ($searches as $s): ?>
                        <div class="history-item group flex items-center gap-2 p-3 rounded-lg hover:bg-dark-700 cursor-pointer transition-colors <?= (isset($result) && $result['id'] === (int)$s['id']) ? 'bg-dark-700 border border-dark-600' : '' ?>">
                            <a href="<?= url("/search/{$s['id']}") ?>" class="flex-1 min-w-0">
                                <div class="text-sm font-medium text-gray-200 truncate"><?= htmlspecialchars($s['keyphrase']) ?></div>
                                <div class="text-xs text-gray-500 mt-0.5"><?= (int)$s['total_tweets'] ?> tweets &middot; <?= date('M j, g:ia', strtotime($s['searched_at'])) ?></div>
                            </a>
                            <button onclick="deleteSearch(<?= (int)$s['id'] ?>)" class="delete-btn p-1.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors" title="Delete">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </aside>

        <main class="flex-1 overflow-y-auto p-6">
            <div class="max-w-6xl mx-auto">
                <form method="POST" action="<?= url('/search') ?>" class="mb-8" id="search-form">
                    <div class="flex gap-3">
                        <input type="text" name="keyphrase" placeholder="Enter a keyword or phrase to analyze..." required
                               class="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
                        <button type="submit" id="search-btn"
                                class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                            Analyze
                        </button>
                    </div>
                </form>

                <?php if (!empty($error)): ?>
                    <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                        <p class="text-red-400 text-sm"><?= htmlspecialchars($error) ?></p>
                    </div>
                <?php endif; ?>

                <?php if ($result): ?>
                    <?php include __DIR__ . '/search-result.php'; ?>
                <?php elseif (empty($error)): ?>
                    <div class="flex flex-col items-center justify-center h-96 text-center">
                        <svg class="w-16 h-16 text-gray-600 mb-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"/></svg>
                        <h2 class="text-xl font-semibold text-gray-400 mb-2">Search Twitter/X</h2>
                        <p class="text-gray-500 text-sm max-w-md">Enter a keyword or phrase above to analyze sentiment, engagement, and trends from recent tweets.</p>
                    </div>
                <?php endif; ?>
            </div>
        </main>
    </div>

    <script>
        const BASE = '<?= url('') ?>';

        document.getElementById('search-form').addEventListener('submit', function() {
            const btn = document.getElementById('search-btn');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Analyzing...';
        });

        function deleteSearch(id) {
            if (!confirm('Delete this search?')) return;
            fetch(BASE + '/api/searches/' + id, { method: 'DELETE' })
                .then(r => r.json())
                .then(() => window.location.href = BASE + '/');
        }

        function exportCSV() {
            const data = window.__searchData;
            if (!data || !data.tweets) return;

            const headers = ['ID','Text','Author','Sentiment','Score','Likes','Retweets','Replies','Created At'];
            const rows = data.tweets.map(t => [
                t.id,
                '"' + (t.text || '').replace(/"/g, '""') + '"',
                t.authorUsername,
                t.sentiment,
                t.sentimentScore,
                t.likes,
                t.retweets,
                t.replies,
                t.createdAt
            ]);

            let csv = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.keyphrase.replace(/\s+/g, '_') + '_tweets.csv';
            a.click();
            URL.revokeObjectURL(url);
        }
    </script>
</body>
</html>
