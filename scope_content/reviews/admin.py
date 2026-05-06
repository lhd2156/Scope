from __future__ import annotations

from django.contrib import admin

from reviews.models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('id', 'spot', 'user_id', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('comment', 'user_id', 'spot__title')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at')
    list_select_related = ('spot',)
    list_per_page = 50
