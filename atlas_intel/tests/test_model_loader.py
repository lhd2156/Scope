from app.ml.model_loader import MlModelLoader
from app.services.content_client import Spot
from app.services.health_service import HealthService
from app.services.recommendation_engine import RecommendationEngine
from app.services.vibe_matcher import VibeMatcher


class FakeContentClient:
    def get_all_spots(self):
        return [
            Spot("spot-1", "Trail", "Scenic river walk", "outdoors", "chill", 4.8, 90, 0, 32.75, -97.33, True, 8, ("user-2",)),
            Spot("spot-2", "Tacos", "Late-night tacos", "food", "social", 4.5, 70, 12, 32.76, -97.32, False, 5, ("user-3",)),
        ]

    def get_spot(self, spot_id: str):
        return next((spot for spot in self.get_all_spots() if spot.spot_id == spot_id), None)


class FakeModel:
    def __init__(self):
        self.fit_documents: list[str] | None = None
        self.transform_documents: list[str] | None = None

    def fit_transform(self, documents: list[str]):
        self.fit_documents = documents
        return ["matrix"]

    def transform(self, documents: list[str]):
        self.transform_documents = documents
        return ["user_vector"]

    @staticmethod
    def cosine_similarity(_left, _right):
        return [[0.9, 0.2]]


class FakeLoader:
    def __init__(self, verify_result: bool = True):
        self.verify_result = verify_result
        self.build_calls = 0
        self.model = FakeModel()
        self.verify_calls = 0

    def build_text_similarity_model(self):
        self.build_calls += 1
        return self.model

    def verify(self):
        self.verify_calls += 1
        return self.verify_result


def test_ml_model_loader_builds_real_text_similarity_model():
    loader = MlModelLoader()
    model = loader.build_text_similarity_model()

    matrix = model.fit_transform(["culture food", "food chill vibe"])
    similarities = model.cosine_similarity(matrix[0:1], matrix[1:])

    assert matrix.shape[0] == 2
    assert matrix.shape[1] > 0
    assert similarities.shape == (1, 1)
    assert 0.0 <= float(similarities[0][0]) <= 1.0


def test_ml_model_loader_verify_returns_true_for_runtime_model_load():
    assert MlModelLoader().verify() is True


def test_recommendation_engine_uses_model_loader_for_similarity_model():
    loader = FakeLoader()
    engine = RecommendationEngine(FakeContentClient(), loader)

    recommendations = engine.recommend_spots("user-1", ["spot-2"], ["outdoors"], 1)

    assert loader.build_calls == 1
    assert loader.model.fit_documents == [
        "Scenic river walk outdoors chill",
        "Late-night tacos food social",
    ]
    assert loader.model.transform_documents == ["outdoors social"]
    assert recommendations[0]["spotId"] == "spot-1"


def test_vibe_matcher_uses_model_loader_for_similarity_model():
    loader = FakeLoader()
    matcher = VibeMatcher(FakeContentClient(), loader)

    matches = matcher.match("quiet sunset walk", 1)

    assert loader.build_calls == 1
    assert loader.model.fit_documents == [
        "quiet sunset walk",
        "chill Scenic river walk outdoors",
        "social Late-night tacos food",
    ]
    assert matches[0]["spotId"] == "spot-1"


def test_health_service_ml_model_ready_uses_shared_loader_verification():
    loader = FakeLoader(verify_result=True)
    service = HealthService(loader)

    assert service.ml_model_ready() is True
    assert loader.verify_calls == 1
