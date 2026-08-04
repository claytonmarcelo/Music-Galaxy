<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Playlist extends Model implements HasMedia
{
    use HasFactory, SoftDeletes, InteractsWithMedia;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'owner_id',
        'artwork_url',
        'is_public',
        'is_collaborative',
        'track_count',
        'total_duration',
        'follower_count',
        'source',
        'external_id',
        'external_urls',
        'tags',
        'metadata',
    ];

    protected $casts = [
        'is_public' => 'boolean',
        'is_collaborative' => 'boolean',
        'track_count' => 'integer',
        'total_duration' => 'integer',
        'follower_count' => 'integer',
        'external_urls' => 'array',
        'tags' => 'array',
        'metadata' => 'array',
    ];

    protected $appends = ['artwork_url_full'];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('artwork')
            ->singleFile()
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function tracks(): BelongsToMany
    {
        return $this->belongsToMany(Track::class, 'playlist_tracks')
            ->withPivot('position', 'added_at', 'added_by')
            ->withTimestamps()
            ->orderBy('pivot_position');
    }

    public function followers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_followed_playlists')
            ->withTimestamps();
    }

    public function collaborators(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'playlist_collaborators')
            ->withTimestamps();
    }

    public function getArtworkUrlFullAttribute(): ?string
    {
        $media = $this->getFirstMedia('artwork');
        if ($media) {
            return $media->getFullUrl();
        }
        if ($this->tracks()->exists()) {
            $firstTrack = $this->tracks()->first();
            if ($firstTrack) {
                return $firstTrack->artwork_url;
            }
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

    public function scopePublic($query)
    {
        return $query->where('is_public', true);
    }

    public function scopeOwnedBy($query, int $userId)
    {
        return $query->where('owner_id', $userId);
    }

    public function scopeSearch($query, string $term)
    {
        return $query->where('name', 'like', "%{$term}%")
            ->orWhere('description', 'like', "%{$term}%");
    }

    public function addTrack(Track $track, int $position = null, int $addedBy = null): void
    {
        $maxPosition = $this->tracks()->max('pivot_position') ?? 0;
        $position = $position ?? $maxPosition + 1;

        $this->tracks()->attach($track->id, [
            'position' => $position,
            'added_at' => now(),
            'added_by' => $addedBy ?? auth()->id(),
        ]);

        $this->increment('track_count');
        $this->increment('total_duration', $track->duration);
    }

    public function removeTrack(Track $track): void
    {
        $this->tracks()->detach($track->id);
        $this->decrement('track_count');
        $this->decrement('total_duration', $track->duration);
    }

    public function reorderTracks(array $trackIds): void
    {
        foreach ($trackIds as $index => $trackId) {
            $this->tracks()->wherePivot('track_id', $trackId)
                ->updateExistingPivot($trackId, ['position' => $index + 1]);
        }
    }
}