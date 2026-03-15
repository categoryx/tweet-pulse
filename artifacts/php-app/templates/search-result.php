<?php
$sb = $result['sentimentBreakdown'];
$totalSent = $sb['positive'] + $sb['negative'] + $sb['neutral'];
?>
<script>window.__searchData = <?= json_encode($result, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;</script>

<div class="flex items-center justify-between mb-6">
    <div>
        <h1 class="text-2xl font-bold text-white"><?= htmlspecialchars($result['keyphrase']) ?></h1>
        <p class="text-sm text-gray-500 mt-1">Analyzed <?= date('M j, Y g:ia', strtotime($result['searchedAt'])) ?></p>
    </div>
    <button onclick="exportCSV()" class="bg-dark-700 hover:bg-dark-600 border border-dark-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Export CSV
    </button>
</div>

<div class="grid grid-cols-4 gap-4 mb-6">
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Tweets</p>
        <p class="text-2xl font-bold text-white"><?= number_format($result['totalTweets']) ?></p>
    </div>
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Avg Engagement</p>
        <p class="text-2xl font-bold text-white"><?= number_format($result['averageEngagement'], 1) ?></p>
    </div>
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Sentiment Score</p>
        <p class="text-2xl font-bold <?= $result['overallSentimentScore'] >= 0.1 ? 'text-green-400' : ($result['overallSentimentScore'] <= -0.1 ? 'text-red-400' : 'text-yellow-400') ?>">
            <?= number_format($result['overallSentimentScore'], 3) ?>
        </p>
    </div>
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Sentiment</p>
        <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-green-400"><?= $sb['positivePercent'] ?>% +</span>
            <span class="text-xs text-gray-400"><?= $sb['neutralPercent'] ?>% ~</span>
            <span class="text-xs text-red-400"><?= $sb['negativePercent'] ?>% -</span>
        </div>
    </div>
</div>

<div class="grid grid-cols-2 gap-6 mb-6">
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Sentiment Distribution</h3>
        <div class="flex justify-center">
            <canvas id="sentimentPie" width="220" height="220"></canvas>
        </div>
    </div>
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Volume Over Time</h3>
        <canvas id="volumeChart" height="220"></canvas>
    </div>
</div>

<div class="bg-dark-800 border border-dark-600 rounded-lg p-5 mb-6">
    <h3 class="text-sm font-semibold text-gray-300 mb-3">AI Summary</h3>
    <p class="text-sm text-gray-400 leading-relaxed whitespace-pre-line"><?= htmlspecialchars($result['summary']) ?></p>
    <?php if (!empty($result['keyThemes'])): ?>
        <div class="flex flex-wrap gap-2 mt-4">
            <?php foreach ($result['keyThemes'] as $theme): ?>
                <span class="bg-blue-500/10 text-blue-400 text-xs px-3 py-1 rounded-full border border-blue-500/20"><?= htmlspecialchars($theme) ?></span>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>

<?php if (!empty($result['topSources'])): ?>
<div class="bg-dark-800 border border-dark-600 rounded-lg p-5 mb-6">
    <h3 class="text-sm font-semibold text-gray-300 mb-3">Top Sources</h3>
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead>
                <tr class="text-gray-500 text-xs uppercase">
                    <th class="text-left pb-3">User</th>
                    <th class="text-right pb-3">Tweets</th>
                    <th class="text-right pb-3">Followers</th>
                    <th class="text-right pb-3">Engagement</th>
                    <th class="text-right pb-3">Sentiment</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-dark-600">
                <?php foreach ($result['topSources'] as $src): ?>
                    <tr class="hover:bg-dark-700">
                        <td class="py-2.5">
                            <a href="https://x.com/<?= htmlspecialchars($src['username']) ?>" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                                <?php if (!empty($src['profileImageUrl'])): ?>
                                    <img src="<?= htmlspecialchars($src['profileImageUrl']) ?>" class="w-6 h-6 rounded-full" alt="">
                                <?php endif; ?>
                                <span>@<?= htmlspecialchars($src['username']) ?></span>
                            </a>
                        </td>
                        <td class="text-right text-gray-300"><?= $src['tweetCount'] ?></td>
                        <td class="text-right text-gray-300"><?= number_format($src['followers']) ?></td>
                        <td class="text-right text-gray-300"><?= number_format($src['totalEngagement']) ?></td>
                        <td class="text-right <?= $src['averageSentiment'] >= 0.1 ? 'text-green-400' : ($src['averageSentiment'] <= -0.1 ? 'text-red-400' : 'text-gray-400') ?>">
                            <?= number_format($src['averageSentiment'], 2) ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php endif; ?>

<div class="grid grid-cols-2 gap-6 mb-6">
    <?php if (!empty($result['topHashtags'])): ?>
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-3">Top Hashtags</h3>
        <canvas id="hashtagChart" height="200"></canvas>
    </div>
    <?php endif; ?>
    <?php if (!empty($result['topMentions'])): ?>
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-3">Top Mentions</h3>
        <canvas id="mentionChart" height="200"></canvas>
    </div>
    <?php endif; ?>
</div>

<div class="bg-dark-800 border border-dark-600 rounded-lg p-5 mb-6">
    <h3 class="text-sm font-semibold text-gray-300 mb-4">Tweet Feed</h3>
    <div class="space-y-3">
        <?php foreach (array_slice($result['tweets'], 0, 20) as $tweet): ?>
            <div class="border border-dark-600 rounded-lg p-4 hover:bg-dark-700 transition-colors">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <a href="https://x.com/<?= htmlspecialchars($tweet['authorUsername']) ?>" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-blue-400 hover:text-blue-300">@<?= htmlspecialchars($tweet['authorUsername']) ?></a>
                            <span class="text-xs px-2 py-0.5 rounded-full <?= $tweet['sentiment'] === 'positive' ? 'bg-green-500/10 text-green-400' : ($tweet['sentiment'] === 'negative' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400') ?>">
                                <?= $tweet['sentiment'] ?>
                            </span>
                        </div>
                        <p class="text-sm text-gray-300 leading-relaxed"><?= htmlspecialchars($tweet['text']) ?></p>
                        <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span><?= $tweet['likes'] ?> likes</span>
                            <span><?= $tweet['retweets'] ?> RT</span>
                            <span><?= $tweet['replies'] ?> replies</span>
                            <span><?= date('M j, g:ia', strtotime($tweet['createdAt'])) ?></span>
                        </div>
                    </div>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
</div>

<script>
(function() {
    const data = window.__searchData;

    new Chart(document.getElementById('sentimentPie'), {
        type: 'doughnut',
        data: {
            labels: ['Positive', 'Neutral', 'Negative'],
            datasets: [{
                data: [data.sentimentBreakdown.positive, data.sentimentBreakdown.neutral, data.sentimentBreakdown.negative],
                backgroundColor: ['#22c55e', '#6b7280', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 16, font: { size: 11 } } }
            },
            cutout: '60%'
        }
    });

    if (data.volumeOverTime && data.volumeOverTime.length > 0) {
        new Chart(document.getElementById('volumeChart'), {
            type: 'line',
            data: {
                labels: data.volumeOverTime.map(v => v.date),
                datasets: [{
                    label: 'Tweets',
                    data: data.volumeOverTime.map(v => v.count),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: '#252833' } },
                    y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: '#252833' }, beginAtZero: true }
                }
            }
        });
    }

    if (data.topHashtags && data.topHashtags.length > 0) {
        const el = document.getElementById('hashtagChart');
        if (el) {
            new Chart(el, {
                type: 'bar',
                data: {
                    labels: data.topHashtags.map(h => '#' + h.tag),
                    datasets: [{
                        data: data.topHashtags.map(h => h.count),
                        backgroundColor: '#8b5cf6',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#6b7280' }, grid: { color: '#252833' }, beginAtZero: true },
                        y: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { display: false } }
                    }
                }
            });
        }
    }

    if (data.topMentions && data.topMentions.length > 0) {
        const el = document.getElementById('mentionChart');
        if (el) {
            new Chart(el, {
                type: 'bar',
                data: {
                    labels: data.topMentions.map(m => '@' + m.tag),
                    datasets: [{
                        data: data.topMentions.map(m => m.count),
                        backgroundColor: '#f59e0b',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#6b7280' }, grid: { color: '#252833' }, beginAtZero: true },
                        y: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { display: false } }
                    }
                }
            });
        }
    }
})();
</script>
