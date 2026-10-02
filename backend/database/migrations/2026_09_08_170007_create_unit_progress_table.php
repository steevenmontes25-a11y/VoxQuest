<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-unit rollup derived from exercise_results, plus the unlock state.
     * status: locked | in_progress | completed  (completed = every exercise >= 1 star).
     */
    public function up(): void
    {
        if (Schema::hasTable('unit_progress')) {
            return;
        }

        Schema::create('unit_progress', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('unit_id', 64);
            $table->string('module', 32);
            $table->string('status', 16)->default('locked'); // locked|in_progress|completed
            $table->unsignedSmallInteger('stars_earned')->default(0);     // sum across exercises
            $table->unsignedSmallInteger('stars_possible')->default(0);   // exercises * 3
            $table->unsignedSmallInteger('exercises_cleared')->default(0);
            $table->decimal('best_score', 4, 3)->default(0);
            $table->timestamp('unlocked_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'unit_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('unit_progress');
    }
};
