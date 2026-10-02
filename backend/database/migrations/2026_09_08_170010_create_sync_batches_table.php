<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Audit + whole-batch idempotency for POST /api/v1/sync. If a client retries
     * a batch with the same `idempotency_key`, we return the stored consolidated
     * result instead of re-applying it.
     */
    public function up(): void
    {
        if (Schema::hasTable('sync_batches')) {
            return;
        }

        Schema::create('sync_batches', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_id', 64)->nullable();
            $table->string('idempotency_key', 64);
            $table->unsignedInteger('events_received')->default(0);
            $table->unsignedInteger('events_applied')->default(0);
            $table->unsignedInteger('events_rejected')->default(0);
            $table->json('result')->nullable(); // cached consolidated response
            $table->timestamp('created_at');

            $table->unique(['user_id', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_batches');
    }
};
