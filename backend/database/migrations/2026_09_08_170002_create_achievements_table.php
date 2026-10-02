<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('achievements')) {
            return;
        }

        Schema::create('achievements', function (Blueprint $table): void {
            // String PK so ids match the frontend catalog verbatim ('first-note', ...).
            $table->string('id', 64)->primary();
            $table->string('title');
            $table->string('description');
            $table->string('icon', 16);
            $table->string('category', 32)->default('general');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->json('rule'); // opcode evaluated server-side
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('achievements');
    }
};
