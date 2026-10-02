<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Append-only ledger of every XP gain. The row is never updated or deleted
     * (except via user cascade). users.xp_total is a cache computed from SUM(amount).
     */
    public function up(): void
    {
        if (Schema::hasTable('xp_events')) {
            return;
        }

        Schema::create('xp_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('amount'); // server-computed, capped
            $table->string('source_module', 32);           // breath|pitch|theory|technique|repertoire|system
            $table->string('source_exercise_id', 64)->nullable();
            $table->unsignedTinyInteger('stars')->nullable();       // 0..3
            $table->decimal('score', 4, 3)->nullable();             // 0..1
            $table->boolean('first_clear')->default(false);
            // Idempotency: the client stamps a stable id per local event so retries
            // (or multi-device replays) never double-credit.
            $table->uuid('client_generated_id')->nullable();
            $table->uuid('sync_batch_id')->nullable();
            $table->timestamp('occurred_at');   // client-reported time of the event
            $table->timestamp('created_at');    // server receipt time

            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'source_module']);
            $table->unique(['user_id', 'client_generated_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('xp_events');
    }
};
