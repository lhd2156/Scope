from django.contrib import admin
from trips.models import Like, Trip, TripMember, TripSpot
admin.site.register(Trip)
admin.site.register(TripSpot)
admin.site.register(TripMember)
admin.site.register(Like)
