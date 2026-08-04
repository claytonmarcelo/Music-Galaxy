<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable, HasRoles, SoftDeletes;

    protected $fillable = [
        'username',
        'email',
        'password',
        'display_name',
        'avatar_url',
        'bio',
        'country',
        'locale',
        'timezone',
        'is_active',
        'email_verified_at',
        'last_login_at',
        'settings',
        'preferences',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'last_login_at' => 'datetime',
        'is_active' => 'boolean',
        'settings' => 'array',
        'preferences' => 'array',
        'password' => 'hashed',
    ];

    protected $appends = ['avatar_url_full'];

    public function getAvatarUrlFullAttribute(): ?string
    {
        if ($this->avatar_url) {
            return asset('storage/' . $this->avatar_url);
        }
        return null;
    }

    public function tracks(): HasMany
    {
        return $this->hasMany(Track::class, 'owner_id');
    }

    public function albums(): HasMany
    {
        return $this->hasMany(Album::class, 'owner_id');
    }

    public function playlists(): HasMany
    {
        return $this->hasMany(Playlist::class, 'owner_id');
    }

    public function followedArtists(): BelongsToMany
    {
        return $this->belongsToMany(Artist::class, 'user_followed_artists')
            ->withTimestamps();
    }

    public function followedPlaylists(): BelongsToMany
    {
        return $this->belongsToMany(Playlist::class, 'user_followed_playlists')
            ->withTimestamps();
    }

    public function favoriteTracks(): BelongsToMany
    {
        return $this->belongsToMany(Track::class, 'user_favorite_tracks')
            ->withTimestamps();
    }

    public function favoriteAlbums(): BelongsToMany
    {
        return $this->belongsToMany(Album::class, 'user_favorite_albums')
            ->withTimestamps();
    }

    public function favoriteArtists(): BelongsToMany
    {
        return $this->belongsToMany(Artist::class, 'user_favorite_artists')
            ->withTimestamps();
    }

    public function playHistory(): HasMany
    {
        return $this->hasMany(PlayHistory::class)->orderBy('played_at', 'desc');
    }

    public function devices(): HasMany
    {
        return $this->hasMany(UserDevice::class);
    }

    public function socialAccounts(): HasMany
    {
        return $this->hasMany(SocialAccount::class);
    }

    public function downloads(): HasMany
    {
        return $this->hasMany(Download::class);
    }

    public function apiTokens(): MorphMany
    {
        return $this->morphMany(\Laravel\Sanctum\PersonalAccessToken::class, 'tokenable');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeVerified($query)
    {
        return $query->whereNotNull('email_verified_at');
    }
}