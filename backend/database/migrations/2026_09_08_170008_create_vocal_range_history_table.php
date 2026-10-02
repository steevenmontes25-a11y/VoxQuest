<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Snapshots of the detected vocal range over time, for the evolution chart.
     * The range is a client-detected result; the server stores it, never recomputes.
     */
    public function up(): void
    {
        if (Schema::hasTable('vocal_range_history')) {
            return;
        }

        Schema::create('vocal_range_history', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->smallInteger('low_midi');
            $table->smallInteger('high_midi');
            $table->decimal('avg_pitch_error_cents', 6, 2)->nullable();
            $table->uuid('client_generated_id')->nullable();
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['user_id', 'recorded_at']);
            $table->unique(['user_id', 'client_generated_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vocal_range_history');
    }
};
