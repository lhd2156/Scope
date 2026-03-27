from django.contrib import admin
from spots.models import Spot
@admin.register(Spot)
class SpotAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'city', 'country', 'is_public', 'created_at')
    search_fields = ('title', 'city', 'country', 'vibe')
    list_filter = ('category', 'is_public', 'city', 'country')
