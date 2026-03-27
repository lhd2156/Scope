from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.services.content_client import ContentServiceClient

class VibeMatcher:
    def __init__(self, content_client: ContentServiceClient) -> None:
        self.content_client = content_client

    def match(self, description: str, limit: int) -> list[dict]:
        spots = self.content_client.get_all_spots()
        corpus = [description] + [f"{spot.vibe} {spot.description} {spot.category}" for spot in spots]
        vectorizer = TfidfVectorizer()
        matrix = vectorizer.fit_transform(corpus)
        similarities = cosine_similarity(matrix[0:1], matrix[1:])[0]
        matches = []
        for index, spot in enumerate(spots):
            matches.append({"spotId": spot.spot_id, "title": spot.title, "vibe": spot.vibe, "score": round(float(similarities[index]), 4)})
        return sorted(matches, key=lambda item: item["score"], reverse=True)[:limit]
