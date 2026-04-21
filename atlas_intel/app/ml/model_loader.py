from __future__ import annotations

import logging
from dataclasses import dataclass
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)
VALIDATION_CORPUS = ("atlas intel health", "ml model ready")


@dataclass
class TextSimilarityModel:
    vectorizer: TfidfVectorizer

    def fit_transform(self, documents: list[str]):
        return self.vectorizer.fit_transform(documents)

    def transform(self, documents: list[str]):
        return self.vectorizer.transform(documents)

    @staticmethod
    def cosine_similarity(left, right):
        return cosine_similarity(left, right)


class MlModelLoader:
    def build_text_similarity_model(self) -> TextSimilarityModel:
        return TextSimilarityModel(TfidfVectorizer())

    def verify(self) -> bool:
        try:
            model = self.build_text_similarity_model()
            matrix = model.fit_transform(list(VALIDATION_CORPUS))
            return matrix.shape[0] == len(VALIDATION_CORPUS) and matrix.shape[1] > 0
        except Exception:
            logger.warning("ml_model_load_failed", extra={"dependency": "ml"})
            return False


ml_model_loader = MlModelLoader()
