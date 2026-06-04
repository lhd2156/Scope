from app.ml.model_loader import MlModelLoader, ml_model_loader
from app.services.content_client import ContentServiceClient, Spot


class VibeMatcher:
    def __init__(self, content_client: ContentServiceClient, model_loader: MlModelLoader = ml_model_loader) -> None:
        self.content_client = content_client
        self.model_loader = model_loader

    def match(self, description: str, limit: int) -> list[dict]:
        spots = self.content_client.get_all_spots()
        if not spots:
            return []

        query_terms = self._tokens(description)
        corpus = [description] + [f"{spot.title} {spot.vibe} {spot.description} {spot.category}" for spot in spots]
        model = self.model_loader.build_text_similarity_model()
        matrix = model.fit_transform(corpus)
        similarities = model.cosine_similarity(matrix[0:1], matrix[1:])[0]
        matches = []
        for index, spot in enumerate(spots):
            lexical_boost = self._lexical_boost(spot, query_terms)
            score = min(1.0, float(similarities[index]) + lexical_boost + (0.04 * min(spot.rating / 5, 1)))
            matches.append(self._serialize_match(spot, score, lexical_boost))
        return sorted(matches, key=lambda item: item["score"], reverse=True)[:limit]

    @staticmethod
    def _tokens(value: str) -> set[str]:
        return {
            token
            for token in value.lower().replace(",", " ").replace(".", " ").split()
            if len(token) > 2
        }

    def _lexical_boost(self, spot: Spot, query_terms: set[str]) -> float:
        if not query_terms:
            return 0.0
        vibe_terms = self._tokens(spot.vibe)
        category_terms = self._tokens(spot.category)
        title_terms = self._tokens(spot.title)
        description_terms = self._tokens(spot.description)
        boost = 0.0
        if query_terms & vibe_terms:
            boost += 0.18
        if query_terms & category_terms:
            boost += 0.12
        if query_terms & title_terms:
            boost += 0.08
        if query_terms & description_terms:
            boost += 0.06
        return min(boost, 0.28)

    @staticmethod
    def _serialize_match(spot: Spot, score: float, lexical_boost: float) -> dict:
        confidence = round(min(0.96, max(0.42, 0.46 + (score * 0.5))), 2)
        if lexical_boost >= 0.18 and spot.vibe:
            reason = f"Matches the {spot.vibe} vibe in your request."
        elif lexical_boost >= 0.12:
            reason = f"Fits the {spot.category} theme you described."
        else:
            reason = f"Closest semantic match with a {spot.rating:.1f} rating."

        return {
            "id": spot.spot_id,
            "spotId": spot.spot_id,
            "title": spot.title,
            "description": spot.description,
            "latitude": spot.latitude,
            "longitude": spot.longitude,
            "category": spot.category,
            "vibe": spot.vibe,
            "rating": spot.rating,
            "score": round(score, 4),
            "confidence": confidence,
            "reason": reason,
        }
