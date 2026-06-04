from __future__ import annotations

from django.contrib import admin

from spots.models import Spot


@admin.register(Spot)
class SpotAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'city', 'country', 'user_id', 'is_public', 'verification_status', 'safety_status', 'created_at')
    list_filter = ('category', 'city', 'country', 'is_public', 'verification_status', 'safety_status', 'created_at')
    search_fields = ('title', 'description', 'address', 'city', 'country', 'vibe', 'provider_place_name', 'provider_place_address', 'user_id')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'verified_at')
    list_per_page = 50
