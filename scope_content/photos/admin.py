from __future__ import annotations

from django.contrib import admin

from photos.models import Photo


@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ('id', 'spot', 'user_id', 'sort_order', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('caption', 'storage_key', 'storage_url', 'user_id', 'spot__title')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'storage_key', 'storage_url', 'thumbnail_url', 'created_at')
    list_select_related = ('spot',)
    list_per_page = 50
