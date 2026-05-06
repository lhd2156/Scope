"""gRPC IntelService implementation."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import grpc

logger = logging.getLogger(__name__)

PROTO_DIR = Path(__file__).resolve().parent / "proto"
if str(PROTO_DIR) not in sys.path:
    sys.path.insert(0, str(PROTO_DIR))

from scope.v1 import intel_pb2, intel_pb2_grpc  # noqa: E402


class IntelServiceServicer(intel_pb2_grpc.IntelServiceServicer):
    """Implements the IntelService gRPC interface."""

    def AnalyzeSentiment(self, request, context):
        from app.ml.inference.sentiment import analyze_sentiment

        result = analyze_sentiment(request.text)
        return intel_pb2.SentimentResponse(
            label=result["label"],
            score=float(result["score"]),
            normalized_score=float(result["normalized_score"]),
            review_id=request.review_id,
        )

    def AnalyzeSentimentBatch(self, request, context):
        from app.ml.inference.sentiment import analyze_batch

        results = analyze_batch(list(request.texts))
        return intel_pb2.SentimentBatchResponse(
            results=[
                intel_pb2.SentimentResponse(
                    label=result["label"],
                    score=float(result["score"]),
                    normalized_score=float(result["normalized_score"]),
                )
                for result in results
            ]
        )

    def ClassifyImage(self, request, context):
        from app.ml.inference.tagger import classify_from_url, classify_image

        top_k = request.top_k or 5
        if request.url:
            tags = classify_from_url(request.url, top_k)
        elif request.image_data:
            tags = classify_image(request.image_data, top_k)
        else:
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details("Provide url or image_data")
            return intel_pb2.ClassifyImageResponse()

        return intel_pb2.ClassifyImageResponse(
            tags=[intel_pb2.ImageTag(tag=tag["tag"], confidence=float(tag["confidence"])) for tag in tags],
            photo_id=request.photo_id,
        )

    def PredictTrip(self, request, context):
        from app.ml.inference.predictor import predict_trip

        result = predict_trip(
            {
                "num_spots": request.num_spots,
                "total_distance_km": request.total_distance_km,
                "avg_rating": request.avg_rating,
                "num_outdoor": request.num_outdoor,
                "num_food": request.num_food,
                "num_cultural": request.num_cultural,
                "month": request.month,
            }
        )
        return intel_pb2.PredictTripResponse(
            predicted_days=float(result["predicted_days"]),
            predicted_cost_usd=float(result["predicted_cost_usd"]),
            confidence=float(result["confidence"]),
            source=result["source"],
        )

    def GetRecommendations(self, request, context):
        from app.ml.inference.recommender import recommend_spots

        spots = recommend_spots(request.user_id, request.limit or 10)
        return intel_pb2.RecommendationResponse(
            spots=[
                intel_pb2.RecommendedSpot(
                    spot_id=str(spot["spot_id"]),
                    score=float(spot["score"]),
                    source=str(spot["source"]),
                )
                for spot in spots
            ]
        )
