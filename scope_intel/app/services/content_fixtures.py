"""Fallback / test-only spot fixtures for the Intelligence service.

These exist strictly for offline tests and explicit fixture-client injection.
They must NEVER be the data source in production or normal local development:
`ContentServiceClient` routes to `HttpContentServiceClient` whenever
`TESTING` is False, and a missing `CONTENT_SERVICE_URL` is a configuration
error.

Intentionally kept tiny (six spots) so a test author cannot accidentally
conflate "it returned 6 results" with "recommendations are working".
"""

from __future__ import annotations

from app.services.spot import Spot

SAMPLE_SPOTS: tuple[Spot, ...] = (
    Spot("spot-1", "Fort Worth Taco Trail", "Tacos and street food near downtown", "food", "lively", 4.8, 91, 25, 32.7555, -97.3308, False, 18, ("user-1", "user-2")),
    Spot("spot-2", "Kimbell Art Museum", "World-class art and architecture", "culture", "inspiring", 4.9, 84, 20, 32.7489, -97.3623, False, 42, ("user-2", "user-3")),
    Spot("spot-3", "Trinity Trails Sunset", "Scenic river walk and cycling trail", "outdoors", "chill", 4.7, 79, 0, 32.7507, -97.3511, True, 27, ("user-1", "user-4")),
    Spot("spot-4", "Magnolia Night Market", "Late-night food and local music", "nightlife", "electric", 4.6, 88, 35, 32.7313, -97.3200, True, 24, ("user-2", "user-4")),
    Spot("spot-5", "Botanic Garden Escape", "Relaxed garden paths and seasonal blooms", "nature", "serene", 4.5, 72, 16, 32.7410, -97.3634, True, 30, ("user-3", "user-4")),
    Spot("spot-6", "Stockyards History Walk", "Historic district with culture and food", "culture", "western", 4.4, 86, 15, 32.7877, -97.3462, True, 33, ("user-1", "user-3")),
)
