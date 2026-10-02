<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Achievement extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['id', 'title', 'description', 'icon', 'category', 'sort_order', 'rule'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'rule' => 'array',
            'sort_order' => 'integer',
        ];
    }
}
