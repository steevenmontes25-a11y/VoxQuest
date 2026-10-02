<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-exercise best result. Mirrors the frontend `results` map keyed by
     * exerciseId. Conflict rule on sync: "best wins" (higher stars, higher score,
     * higher accumulated metrics). unit_progress is a derived rollup of this.
     */
    public function up(): void
    {
        if (Schema::hasTable('exercise_results')) {
            return;
        }

        Schema::create('exercise_results', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('exercise_id', 64);
            $table->string('unit_id', 64);
            $table->string('module', 32);
            $table->unsignedTinyInteger('stars')->default(0);       // best 0..3
            $table->decimal('best_score', 4, 3)->default(0);        // best 0..1
            $table->unsignedInteger('attempts')->default(0);
            // Accumulated per-kind metrics (airSeconds, vibratoSeconds, perfectNotes...).
            // Merged as max() on each key during sync.
            $table->json('metrics')->nullable();
            $table->timestamp('last_played_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'exercise_id']);
            $table->index(['user_id', 'unit_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exercise_results');
    }
};
