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

class Track extends Model implements HasMedia
{
    use HasFactory, SoftDeletes, InteractsWithMedia;

    protected $fillable = [
        'title',
        'artist_id',
        'album_id',
        'owner_id',
        'duration',
        'track_number',
        'disc_number',
        'isrc',
        'iswc',
        'lyrics',
        'synced_lyrics',
        'language',
        'explicit',
        'popularity',
        'play_count',
        'release_date',
        'genres',
        'moods',
        'tags',
        'bpm',
        'key_signature',
        'time_signature',
        'audio_url',
        'preview_url',
        'waveform_url',
        'quality',
        'bitrate',
        'sample_rate',
        'channels',
        'file_size',
        'file_format',
        'source',
        'external_id',
        'external_urls',
        'is_available',
        'is_streamable',
        'is_downloadable',
        'copyright',
        'publisher',
        'composer',
        'producer',
        'remixer',
        'featured_artists',
        'metadata',
    ];

    protected $casts = [
        'duration' => 'integer',
        'track_number' => 'integer',
        'disc_number' => 'integer',
        'explicit' => 'boolean',
        'popularity' => 'integer',
        'play_count' => 'integer',
        'release_date' => 'date',
        'genres' => 'array',
        'moods' => 'array',
        'tags' => 'array',
        'bpm' => 'decimal:2',
        'quality' => 'string',
        'bitrate' => 'integer',
        'sample_rate' => 'integer',
        'channels' => 'integer',
        'file_size' => 'integer',
        'external_urls' => 'array',
        'is_available' => 'boolean',
        'is_streamable' => 'boolean',
        'is_downloadable' => 'boolean',
        'featured_artists' => 'array',
        'metadata' => 'array',
    ];

    protected $appends = ['audio_url_full', 'preview_url_full', 'waveform_url_full', 'artwork_url'];

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('artwork')
            ->singleFile()
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);

        $this->addMediaCollection('audio')
            ->singleFile()
            ->acceptsMimeTypes(['audio/mpeg', 'audio/mp4', 'audio/flac', 'audio/ogg', 'audio/wav']);

        $this->addMediaCollection('waveform')
            ->singleFile()
            ->acceptsMimeTypes(['image/png', 'image/svg+xml']);
    }

    public function artist(): BelongsTo
    {
        return $this->belongsTo(Artist::class);
    }

    public function album(): BelongsTo
    {
        return $this->belongsTo(Album::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function playlists(): BelongsToMany
    {
        return $this->belongsToMany(Playlist::class, 'playlist_tracks')
            ->withPivot('position', 'added_at')
            ->withTimestamps()
            ->orderBy('pivot_position');
    }

    public function favoritedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_favorite_tracks')
            ->withTimestamps();
    }

    public function playHistory(): HasMany
    {
        return $this->hasMany(PlayHistory::class);
    }

    public function downloads(): HasMany
    {
        return $this->hasMany(Download::class);
    }

    public function getAudioUrlFullAttribute(): ?string
    {
        if ($this->audio_url) {
            return asset('storage/' . $this->audio_url);
        }
        return null;
    }

    public function getPreviewUrlFullAttribute(): ?string
    {
        if ($this->preview_url) {
            return asset('storage/' . $this->preview_url);
        }
        return null;
    }

    public function getWaveformUrlFullAttribute(): ?string
    {
        if ($this->waveform_url) {
            return asset('storage/' . $this->waveform_url);
        }
        return null;
    }

    public function getArtworkUrlAttribute(): ?string
    {
        $media = $this->getFirstMedia('artwork');
        if ($media) {
            return $media->getFullUrl();
        }
        if ($this->album) {
            return $this->album->artwork_url;
        }
        if ($this->artist) {
            return $this->artist->artwork_url;
        }
        return null;
    }

    public function getDurationFormattedAttribute(): string
    {
        $minutes = floor($this->duration / 60);
        $seconds = $this->duration % 60;
        return sprintf('%d:%02d', $minutes, $seconds);
    }

    public function scopeAvailable($query)
    {
        return $query->where('is_available', true);
    }

    public function scopeStreamable($query)
    {
        return $query->where('is_streamable', true);
    }

    public function scopeDownloadable($query)
    {
        return $query->where('is_downloadable', true);
    }

    public function scopeBySource($query, string $source)
    {
        return $query->where('source', $source);
    }

    public function scopeSearch($query, string $term)
    {
        return $query->where(function ($q) use ($term) {
            $q->where('title', 'like', "%{$term}%")
              ->orWhereHas('artist', fn($aq) => $aq->where('name', 'like', "%{$term}%"))
              ->orWhereHas('album', fn($aq) => $aq->where('title', 'like', "%{$term}%"));
        });
    }
}