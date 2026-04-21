from app.ml.model_loader import MlModelLoader, ml_model_loader
from app.services.content_client import ContentServiceClient

class VibeMatcher:
    def __init__(self, content_client: ContentServiceClient, model_loader: MlModelLoader = ml_model_loader) -> None:
        self.content_client = content_client
        self.model_loader = model_loader

    def match(self, description: str, limit: int) -> list[dict]:
        spots = self.content_client.get_all_spots()
        corpus = [description] + [f"{spot.vibe} {spot.description} {spot.category}" for spot in spots]
        model = self.model_loader.build_text_similarity_model()
        matrix = model.fit_transform(corpus)
        similarities = model.cosine_similarity(matrix[0:1], matrix[1:])[0]
        matches = []
        for index, spot in enumerate(spots):
            matches.append({"spotId": spot.spot_id, "title": spot.title, "vibe": spot.vibe, "score": round(float(similarities[index]), 4)})
        return sorted(matches, key=lambda item: item["score"], reverse=True)[:limit]
