<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Artist extends Model implements HasMedia
{
    use HasFactory, SoftDeletes, InteractsWithMedia;

    protected $fillable = [
        'name',
        'slug',
        'bio',
        'artwork_url',
        'header_url',
        'country',
        'genres',
        'moods',
        'tags',
        'popularity',
        'follower_count',
        'monthly_listeners',
        'is_verified',
        'verified_at',
        'external_ids',
        'external_urls',
        'social_links',
        'formed_year',
        'disbanded_year',
        'metadata',
    ];

    protected $casts = [
        'popularity' => 'integer',
        'follower_count' => 'integer',
        'monthly_listeners' => 'integer',
        'is_verified' => 'boolean',
        'verified_at' => 'datetime',
        'genres' => 'array',
        'moods' => 'array',
        'tags' => 'array',
        'external_ids' => 'array',
        'external_urls' => 'array',
        'social_links' => 'array',
        'formed_year' => 'integer',
        'disbanded_year' => 'integer',
        'metadata' => 'array',
    ];

    protected $appends = ['artwork_url_full', 'header_url_full'];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('artwork')
            ->singleFile()
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);

        $this->addMediaCollection('header')
            ->singleFile()
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);
    }

    public function tracks(): HasMany
    {
        return $this->hasMany(Track::class);
    }

    public function albums(): HasMany
    {
        return $this->hasMany(Album::class);
    }

    public function followedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_followed_artists')
            ->withTimestamps();
    }

    public function favoritedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_favorite_artists')
            ->withTimestamps();
    }

    public function similarArtists(): BelongsToMany
    {
        return $this->belongsToMany(Artist::class, 'similar_artists', 'artist_id', 'similar_artist_id')
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

    public function getHeaderUrlFullAttribute(): ?string
    {
        $media = $this->getFirstMedia('header');
        if ($media) {
            return $media->getFullUrl();
        }
        return $this->header_url ? asset('storage/' . $this->header_url) : null;
    }

    public function scopeVerified($query)
    {
        return $query->where('is_verified', true);
    }

    public function scopePopular($query, int $limit = 10)
    {
        return $query->orderBy('popularity', 'desc')->limit($limit);
    }

    public function scopeSearch($query, string $term)
    {
        return $query->where('name', 'like', "%{$term}%")
            ->orWhere('slug', 'like', "%{$term}%");
    }

    public function scopeByGenre($query, string $genre)
    {
        return $query->whereJsonContains('genres', $genre);
    }
}