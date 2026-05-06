from django.urls import path

from interactions.views import record_interaction

urlpatterns = [
    path('', record_interaction),
]
