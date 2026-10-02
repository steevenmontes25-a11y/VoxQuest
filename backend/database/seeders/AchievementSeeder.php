<?php

namespace Database\Seeders;

use App\Models\Achievement;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Seeds the 12-achievement catalog from config/voxquest.php (which mirrors the
 * frontend src/game/achievements.ts). Idempotent: re-running updates rows in place.
 */
class AchievementSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $rows = collect(config('voxquest.achievements'))->map(fn (array $a): array => [
            'id' => $a['id'],
            'title' => $a['title'],
            'description' => $a['description'],
            'icon' => $a['icon'],
            'category' => $a['category'],
            'sort_order' => $a['sort'],
            'rule' => json_encode($a['rule'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        Achievement::query()->upsert(
            $rows,
            uniqueBy: ['id'],
            update: ['title', 'description', 'icon', 'category', 'sort_order', 'rule', 'updated_at'],
        );
    }
}
