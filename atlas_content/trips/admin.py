from __future__ import annotations

from django.contrib import admin

from trips.models import Like, Trip, TripMember, TripSpot


class TripSpotInline(admin.TabularInline):
    model = TripSpot
    extra = 0
    raw_id_fields = ('spot',)
    fields = ('spot', 'day_number', 'sort_order', 'notes')
    ordering = ('day_number', 'sort_order')


class TripMemberInline(admin.TabularInline):
    model = TripMember
    extra = 0
    fields = ('user_id', 'role', 'joined_at')
    readonly_fields = ('joined_at',)
    ordering = ('joined_at',)


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ('title', 'creator_id', 'status', 'is_public', 'start_date', 'end_date', 'created_at')
    list_filter = ('status', 'is_public', 'start_date', 'end_date', 'created_at')
    search_fields = ('title', 'description', 'creator_id')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at')
    inlines = (TripSpotInline, TripMemberInline)
    list_per_page = 50


@admin.register(TripSpot)
class TripSpotAdmin(admin.ModelAdmin):
    list_display = ('trip', 'spot', 'day_number', 'sort_order')
    list_filter = ('day_number',)
    search_fields = ('trip__title', 'spot__title', 'notes')
    ordering = ('trip', 'day_number', 'sort_order')
    raw_id_fields = ('trip', 'spot')
    list_select_related = ('trip', 'spot')
    list_per_page = 50


@admin.register(TripMember)
class TripMemberAdmin(admin.ModelAdmin):
    list_display = ('trip', 'user_id', 'role', 'joined_at')
    list_filter = ('role', 'joined_at')
    search_fields = ('trip__title', 'user_id')
    ordering = ('-joined_at',)
    raw_id_fields = ('trip',)
    list_select_related = ('trip',)
    list_per_page = 50


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ('spot', 'user_id', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('spot__title', 'user_id')
    ordering = ('-created_at',)
    raw_id_fields = ('spot',)
    list_select_related = ('spot',)
    list_per_page = 50
