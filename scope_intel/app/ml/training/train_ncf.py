"""Train Neural Collaborative Filtering model on user-spot interactions.

Usage:
    python -m app.ml.training.train_ncf --data interactions.csv --output app/ml/models/
"""

import argparse
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

logger = logging.getLogger(__name__)


def _parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="CSV with 'user_id', 'item_id', 'rating' columns")
    parser.add_argument("--output", default="app/ml/models/")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=256)
    parser.add_argument("--embedding-dim", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    return parser.parse_args()


def _load_training_arrays(data_path: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    df = pd.read_csv(data_path)
    user_ids = df["user_id"].astype("category").cat.codes.values
    item_ids = df["item_id"].astype("category").cat.codes.values
    ratings = df["rating"].values.astype(np.float32)
    rating_span = ratings.max() - ratings.min()
    ratings = (ratings - ratings.min()) / rating_span if rating_span else np.ones_like(ratings)
    return user_ids, item_ids, ratings


def _train_ncf_model(user_ids: np.ndarray, item_ids: np.ndarray, ratings: np.ndarray, args):
    from app.ml.inference.recommender import NCFModel

    num_users = int(user_ids.max()) + 1
    num_items = int(item_ids.max()) + 1
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = NCFModel(num_users, num_items, args.embedding_dim).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.BCELoss()

    dataset = TensorDataset(torch.LongTensor(user_ids), torch.LongTensor(item_ids), torch.FloatTensor(ratings))
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)

    for epoch in range(args.epochs):
        model.train()
        total_loss = 0
        for batch_users, batch_items, batch_ratings in loader:
            batch_users = batch_users.to(device)
            batch_items = batch_items.to(device)
            batch_ratings = batch_ratings.to(device)

            preds = model(batch_users, batch_items)
            loss = criterion(preds, batch_ratings)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(loader)
        logger.info("Epoch %d/%d - Loss: %.4f", epoch + 1, args.epochs, avg_loss)

    return model, num_users, num_items, device


def _save_ncf_model(output_dir: Path, model, *, num_users: int, num_items: int, embedding_dim: int) -> None:
    output_path = output_dir / "ncf_model.pt"
    torch.save(
        {
            "state_dict": model.state_dict(),
            "num_users": num_users,
            "num_items": num_items,
            "embedding_dim": embedding_dim,
        },
        output_path,
    )
    logger.info("Saved NCF model to %s", output_path)


def _build_faiss_index(output_dir: Path, model, *, num_items: int, device) -> None:
    try:
        import faiss

        model.eval()
        item_embeddings = []
        with torch.no_grad():
            for i in range(num_items):
                idx = torch.tensor([i], device=device)
                gmf = model.item_embedding_gmf(idx)
                mlp = model.item_embedding_mlp(idx)
                emb = torch.cat([gmf, mlp], dim=-1).cpu().numpy().flatten()
                item_embeddings.append(emb)

        embeddings = np.array(item_embeddings, dtype=np.float32)
        index = faiss.IndexFlatL2(embeddings.shape[1])
        index.add(embeddings)

        faiss_path = output_dir / "faiss_index.bin"
        faiss.write_index(index, str(faiss_path))
        logger.info("Saved FAISS index (%d vectors) to %s", index.ntotal, faiss_path)
    except ImportError:
        logger.warning("FAISS not available - skipping index build")


def main():
    args = _parse_args()
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    user_ids, item_ids, ratings = _load_training_arrays(args.data)
    model, num_users, num_items, device = _train_ncf_model(user_ids, item_ids, ratings, args)
    _save_ncf_model(output_dir, model, num_users=num_users, num_items=num_items, embedding_dim=args.embedding_dim)
    _build_faiss_index(output_dir, model, num_items=num_items, device=device)


if __name__ == "__main__":
    main()
