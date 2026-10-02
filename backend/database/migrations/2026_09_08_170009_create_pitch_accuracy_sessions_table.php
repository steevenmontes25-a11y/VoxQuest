<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Aggregated summary of one practice session. NO raw audio and NO per-frame
     * pitch stream is ever stored — only these aggregates.
     */
    public function up(): void
    {
        if (Schema::hasTable('pitch_accuracy_sessions')) {
            return;
        }

        Schema::create('pitch_accuracy_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('module', 32);
            $table->string('exercise_id', 64)->nullable();
            $table->decimal('avg_score', 4, 3);            // 0..1
            $table->decimal('avg_error_cents', 6, 2);      // mean absolute deviation
            $table->unsignedInteger('duration_seconds');
            $table->unsignedInteger('notes_total')->nullable();
            $table->unsignedInteger('notes_in_tune')->nullable();
            $table->uuid('client_generated_id')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamp('created_at');

            $table->index(['user_id', 'occurred_at']);
            $table->unique(['user_id', 'client_generated_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pitch_accuracy_sessions');
    }
};
