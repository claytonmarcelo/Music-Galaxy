<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Album extends Model implements HasMedia
{
    use HasFactory, SoftDeletes, InteractsWithMedia;

    protected $fillable = [
        'title',
        'slug',
        'artist_id',
        'owner_id',
        'type',
        'release_date',
        'total_tracks',
        'total_duration',
        'label',
        'copyright',
        'upc',
        'genres',
        'moods',
        'tags',
        'popularity',
        'artwork_url',
        'external_ids',
        'external_urls',
        'is_compilation',
        'is_explicit',
        'is_available',
        'metadata',
    ];

    protected $casts = [
        'release_date' => 'date',
        'total_tracks' => 'integer',
        'total_duration' => 'integer',
        'popularity' => 'integer',
        'genres' => 'array',
        'moods' => 'array',
        'tags' => 'array',
        'external_ids' => 'array',
        'external_urls' => 'array',
        'is_compilation' => 'boolean',
        'is_explicit' => 'boolean',
        'is_available' => 'boolean',
        'metadata' => 'array',
    ];

    protected $appends = ['artwork_url_full'];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('artwork')
            ->singleFile()
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);
    }

    public function artist(): BelongsTo
    {
        return $this->belongsTo(Artist::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function tracks(): HasMany
    {
        return $this->hasMany(Track::class)->orderBy('disc_number')->orderBy('track_number');
    }

    public function savedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_saved_albums')
            ->withTimestamps();
    }

    public function favoritedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_favorite_albums')
            ->withTimestamps();
    }

    public function getArtworkUrlFullAttribute(): ?string
    {
        $media = $this->getFirstMedia('artwork');
        if ($media) {
            return $media->getFullUrl();
        }
        return $this->artwork_url ? asset('storage/' . $this->artwork_url) : null;
    }

    public function getDurationFormattedAttribute(): string
    {
        $hours = floor($this->total_duration / 3600);
        $minutes = floor(($this->total_duration % 3600) / 60);
        $seconds = $this->total_duration % 60;

        if ($hours > 0) {
            return sprintf('%d:%02d:%02d', $hours, $minutes, $seconds);
        }
        return sprintf('%d:%02d', $minutes, $seconds);
    }

    public function scopeAvailable($query)
    {
        return $query->where('is_available', true);
    }

    public function scopeByType($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeSearch($query, string $term)
    {
        return $query->where('title', 'like', "%{$term}%")
            ->orWhereHas('artist', fn($aq) => $aq->where('name', 'like', "%{$term}%"));
    }

    public function scopeByGenre($query, string $genre)
    {
        return $query->whereJsonContains('genres', $genre);
    }
}