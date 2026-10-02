<?php

namespace App\Console\Commands;

use App\Domain\Admin\AdminMetricsService;
use Illuminate\Console\Command;

class ShowMetrics extends Command
{
    protected $signature = 'voxquest:metrics {--json : Output raw JSON}';

    protected $description = 'Print aggregate VoxQuest usage metrics';

    public function handle(AdminMetricsService $metrics): int
    {
        $data = $metrics->snapshot();

        if ($this->option('json')) {
            $this->line(json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            return self::SUCCESS;
        }

        $this->components->twoColumnDetail('<fg=gray>Generated</>', $data['generated_at']);
        $this->newLine();

        foreach ([
            'Usuarios (total)' => $data['users_total'],
            'Usuarios con onboarding' => $data['users_onboarded'],
            'Activos ultimos 7 dias' => $data['active_users_7d'],
            'Ejercicios completados' => $data['exercises_completed_total'],
            'Intentos totales' => $data['exercise_attempts_total'],
            'XP otorgada (total)' => $data['xp_awarded_total'],
            'Logros desbloqueados' => $data['achievements_unlocked_total'],
        ] as $label => $value) {
            $this->components->twoColumnDetail($label, (string) $value);
        }

        $this->newLine();
        $this->info('Distribucion de tipos de voz:');
        foreach ($data['voice_type_distribution'] as $type => $count) {
            $this->components->twoColumnDetail("  {$type}", (string) $count);
        }

        $this->newLine();
        $this->info('Ejercicios completados por modulo:');
        foreach ($data['completions_by_module'] as $module => $count) {
            $this->components->twoColumnDetail("  {$module}", (string) $count);
        }

        return self::SUCCESS;
    }
}
