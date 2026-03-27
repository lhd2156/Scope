from __future__ import annotations
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.services.content_client import ContentServiceClient, Spot

class RecommendationEngine:
    def __init__(self, content_client: ContentServiceClient) -> None:
        self.content_client = content_client

    def recommend_spots(self, user_id: str, liked_spot_ids: list[str], interests: list[str], limit: int) -> list[dict]:
        spots = self.content_client.get_all_spots()
        documents = [f"{spot.description} {spot.category} {spot.vibe}" for spot in spots]
        vectorizer = TfidfVectorizer()
        matrix = vectorizer.fit_transform(documents)
        user_profile = " ".join(interests + [spot.vibe for spot in spots if spot.spot_id in liked_spot_ids]) or "adventure culture food"
        user_vector = vectorizer.transform([user_profile])
        similarities = cosine_similarity(user_vector, matrix)[0]
        recommendations = []
        for index, spot in enumerate(spots):
            collaborative_score = sum(1 for liker in spot.liked_by_users if liker == user_id or any(liker in self._likers_for_spots(spots, liked_spot_ids) for liker in spot.liked_by_users))
            total_score = round((similarities[index] * 0.7) + (collaborative_score * 0.2) + ((spot.popularity / 100) * 0.1), 4)
            recommendations.append({"spotId": spot.spot_id, "title": spot.title, "category": spot.category, "score": total_score, "reason": f"Matches interests in {spot.category} with {spot.vibe} vibe"})
        filtered = [spot for spot in recommendations if spot["spotId"] not in liked_spot_ids]
        return sorted(filtered, key=lambda item: item["score"], reverse=True)[:limit]

    def similar_spots(self, spot_id: str, limit: int = 5) -> list[dict]:
        spots = self.content_client.get_all_spots()
        source = self.content_client.get_spot(spot_id)
        if source is None:
            return []
        vectorizer = TfidfVectorizer()
        matrix = vectorizer.fit_transform([f"{spot.description} {spot.category} {spot.vibe}" for spot in spots])
        source_index = next(index for index, spot in enumerate(spots) if spot.spot_id == spot_id)
        similarities = cosine_similarity(matrix[source_index], matrix)[0]
        similar = []
        for index, candidate in enumerate(spots):
            if candidate.spot_id == spot_id:
                continue
            similar.append({"spotId": candidate.spot_id, "title": candidate.title, "score": round(float(similarities[index]), 4)})
        return sorted(similar, key=lambda item: item["score"], reverse=True)[:limit]

    @staticmethod
    def _likers_for_spots(spots: list[Spot], liked_spot_ids: list[str]) -> set[str]:
        return {liker for spot in spots if spot.spot_id in liked_spot_ids for liker in spot.liked_by_users}
