<?php
$sb = $result['sentimentBreakdown'];
$pd = $result['profileData'];
?>
<script>window.__userData = <?= json_encode($result, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>;</script>

<div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-4">
        <?php if (!empty($pd['profileImageUrl'])): ?>
            <img src="<?= htmlspecialchars(str_replace('_normal', '_200x200', $pd['profileImageUrl'])) ?>" class="w-16 h-16 rounded-full border-2 border-dark-600" alt="">
        <?php endif; ?>
        <div>
            <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold text-white"><?= htmlspecialchars($pd['name']) ?></h1>
                <?php if (!empty($pd['verified'])): ?>
                    <svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/></svg>
                <?php endif; ?>
            </div>
            <a href="https://x.com/<?= htmlspecialchars($pd['username']) ?>" target="_blank" class="text-blue-400 hover:text-blue-300 text-sm">@<?= htmlspecialchars($pd['username']) ?></a>
            <?php if (!empty($pd['description'])): ?>
                <p class="text-sm text-gray-400 mt-1 max-w-lg"><?= htmlspecialchars($pd['description']) ?></p>
            <?php endif; ?>
        </div>
    </div>
    <button onclick="exportUserCSV()" class="bg-dark-700 hover:bg-dark-600 border border-dark-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Export CSV
    </button>
</div>

<div class="flex items-center gap-6 mb-6 text-sm text-gray-400">
    <span><?= number_format($pd['followersCount'] ?? 0) ?> followers</span>
    <span><?= number_format($pd['followingCount'] ?? 0) ?> following</span>
    <span><?= number_format($pd['tweetCount'] ?? 0) ?> tweets</span>
    <?php if (!empty($pd['createdAt'])): ?>
        <span>Joined <?= date('M Y', strtotime($pd['createdAt'])) ?></span>
    <?php endif; ?>
</div>

<div class="grid grid-cols-4 gap-4 mb-6">
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-4">
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Tweets Analyzed</p>
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
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Sentiment Split</p>
        <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-green-400"><?= $sb['positivePercent'] ?>% +</span>
            <span class="text-xs text-gray-400"><?= $sb['neutralPercent'] ?>% ~</span>
            <span class="text-xs text-red-400"><?= $sb['negativePercent'] ?>% -</span>
        </div>
    </div>
</div>

<div class="bg-dark-800 border border-dark-600 rounded-lg p-5 mb-6">
    <h3 class="text-sm font-semibold text-gray-300 mb-3">AI Account Summary</h3>
    <p class="text-sm text-gray-400 leading-relaxed whitespace-pre-line"><?= htmlspecialchars($result['summary']) ?></p>
    <?php if (!empty($result['keyThemes'])): ?>
        <div class="flex flex-wrap gap-2 mt-4">
            <?php foreach ($result['keyThemes'] as $theme): ?>
                <span class="bg-blue-500/10 text-blue-400 text-xs px-3 py-1 rounded-full border border-blue-500/20"><?= htmlspecialchars($theme) ?></span>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>

<div class="grid grid-cols-2 gap-6 mb-6">
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Sentiment Distribution</h3>
        <div class="flex justify-center">
            <canvas id="sentimentPie" width="220" height="220"></canvas>
        </div>
    </div>
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Tweet Volume Over Time</h3>
        <canvas id="volumeChart" height="220"></canvas>
    </div>
</div>

<div class="grid grid-cols-2 gap-6 mb-6">
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Posting by Day of Week</h3>
        <canvas id="dayChart" height="200"></canvas>
    </div>
    <div class="bg-dark-800 border border-dark-600 rounded-lg p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Posting by Hour</h3>
        <canvas id="hourChart" height="200"></canvas>
    </div>
</div>

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

<?php if (!empty($result['topTweets'])): ?>
<div class="bg-dark-800 border border-dark-600 rounded-lg p-5 mb-6">
    <h3 class="text-sm font-semibold text-gray-300 mb-3">Top Tweets by Engagement</h3>
    <div class="overflow-x-auto">
        <table class="w-full text-sm">
            <thead>
                <tr class="text-gray-500 text-xs uppercase">
                    <th class="text-left pb-3">Tweet</th>
                    <th class="text-right pb-3">Likes</th>
                    <th class="text-right pb-3">RT</th>
                    <th class="text-right pb-3">Replies</th>
                    <th class="text-right pb-3">Sentiment</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-dark-600">
                <?php foreach ($result['topTweets'] as $tt): ?>
                    <tr class="hover:bg-dark-700">
                        <td class="py-2.5 text-gray-300 max-w-md truncate"><?= htmlspecialchars(mb_substr($tt['text'], 0, 100)) ?><?= mb_strlen($tt['text']) > 100 ? '...' : '' ?></td>
                        <td class="text-right text-gray-300"><?= number_format($tt['likes']) ?></td>
                        <td class="text-right text-gray-300"><?= number_format($tt['retweets']) ?></td>
                        <td class="text-right text-gray-300"><?= number_format($tt['replies']) ?></td>
                        <td class="text-right">
                            <span class="text-xs px-2 py-0.5 rounded-full <?= $tt['sentiment'] === 'positive' ? 'bg-green-500/10 text-green-400' : ($tt['sentiment'] === 'negative' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400') ?>">
                                <?= $tt['sentiment'] ?>
                            </span>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php endif; ?>

<div class="bg-dark-800 border border-dark-600 rounded-lg p-5 mb-6">
    <h3 class="text-sm font-semibold text-gray-300 mb-4">Tweet Feed</h3>
    <div class="space-y-3">
        <?php foreach (array_slice($result['tweets'], 0, 20) as $tweet): ?>
            <div class="border border-dark-600 rounded-lg p-4 hover:bg-dark-700 transition-colors">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs px-2 py-0.5 rounded-full <?= $tweet['sentiment'] === 'positive' ? 'bg-green-500/10 text-green-400' : ($tweet['sentiment'] === 'negative' ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400') ?>">
                        <?= $tweet['sentiment'] ?>
                    </span>
                    <span class="text-xs text-gray-500"><?= date('M j, g:ia', strtotime($tweet['createdAt'])) ?></span>
                </div>
                <p class="text-sm text-gray-300 leading-relaxed"><?= htmlspecialchars($tweet['text']) ?></p>
                <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span><?= $tweet['likes'] ?> likes</span>
                    <span><?= $tweet['retweets'] ?> RT</span>
                    <span><?= $tweet['replies'] ?> replies</span>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
</div>

<script>
(function() {
    const data = window.__userData;

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
            plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 16, font: { size: 11 } } } },
            cutout: '60%'
        }
    });

    if (data.volumeOverTime && data.volumeOverTime.length > 0) {
        new Chart(document.getElementById('volumeChart'), {
            type: 'line',
            data: {
                labels: data.volumeOverTime.map(v => v.date),
                datasets: [{
                    label: 'Tweets', data: data.volumeOverTime.map(v => v.count),
                    borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)',
                    fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true, plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: '#252833' } },
                    y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: '#252833' }, beginAtZero: true }
                }
            }
        });
    }

    if (data.postingByDayOfWeek) {
        new Chart(document.getElementById('dayChart'), {
            type: 'bar',
            data: {
                labels: data.postingByDayOfWeek.map(d => d.day),
                datasets: [{ data: data.postingByDayOfWeek.map(d => d.count), backgroundColor: '#8b5cf6', borderRadius: 4 }]
            },
            options: {
                responsive: true, plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
                    y: { ticks: { color: '#6b7280' }, grid: { color: '#252833' }, beginAtZero: true }
                }
            }
        });
    }

    if (data.postingByHour) {
        new Chart(document.getElementById('hourChart'), {
            type: 'bar',
            data: {
                labels: data.postingByHour.map(h => h.hour + ':00'),
                datasets: [{ data: data.postingByHour.map(h => h.count), backgroundColor: '#f59e0b', borderRadius: 3 }]
            },
            options: {
                responsive: true, plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#9ca3af', font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
                    y: { ticks: { color: '#6b7280' }, grid: { color: '#252833' }, beginAtZero: true }
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
                    datasets: [{ data: data.topHashtags.map(h => h.count), backgroundColor: '#8b5cf6', borderRadius: 4 }]
                },
                options: {
                    responsive: true, indexAxis: 'y', plugins: { legend: { display: false } },
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
                    datasets: [{ data: data.topMentions.map(m => m.count), backgroundColor: '#f59e0b', borderRadius: 4 }]
                },
                options: {
                    responsive: true, indexAxis: 'y', plugins: { legend: { display: false } },
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
