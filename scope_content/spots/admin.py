from __future__ import annotations

from django.contrib import admin

from spots.models import Spot


@admin.register(Spot)
class SpotAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'city', 'country', 'user_id', 'is_public', 'created_at')
    list_filter = ('category', 'city', 'country', 'is_public', 'created_at')
    search_fields = ('title', 'description', 'address', 'city', 'country', 'vibe', 'user_id')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    list_per_page = 50
