<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'avatar_url')) {
                $table->string('avatar_url')->nullable()->after('email');
            }
            if (! Schema::hasColumn('users', 'voice_type_key')) {
                $table->string('voice_type_key', 32)->nullable()->after('avatar_url');
            }
            if (! Schema::hasColumn('users', 'voice_type_label')) {
                $table->string('voice_type_label', 64)->nullable()->after('voice_type_key');
            }
            if (! Schema::hasColumn('users', 'range_low_midi')) {
                $table->smallInteger('range_low_midi')->nullable()->after('voice_type_label');
            }
            if (! Schema::hasColumn('users', 'range_high_midi')) {
                $table->smallInteger('range_high_midi')->nullable()->after('range_low_midi');
            }
            if (! Schema::hasColumn('users', 'onboarded_at')) {
                $table->timestamp('onboarded_at')->nullable()->after('range_high_midi');
            }
            // Cached rollup of xp_events.amount. xp_events remains the source of truth.
            if (! Schema::hasColumn('users', 'xp_total')) {
                $table->unsignedBigInteger('xp_total')->default(0)->after('onboarded_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            foreach ([
                'avatar_url', 'voice_type_key', 'voice_type_label',
                'range_low_midi', 'range_high_midi', 'onboarded_at', 'xp_total',
            ] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
