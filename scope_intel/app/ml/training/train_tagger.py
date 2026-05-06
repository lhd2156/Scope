"""Fine-tune EfficientNet image tagger on Scope travel photos.

Usage:
    python -m app.ml.training.train_tagger --data images.csv --image-root ./images --output app/ml/models/tagger.pt
"""

import argparse
import logging
from pathlib import Path

import pandas as pd
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

logger = logging.getLogger(__name__)


class TravelImageDataset(Dataset):
    def __init__(self, frame: pd.DataFrame, image_root: Path, transform):
        self.frame = frame.reset_index(drop=True)
        self.image_root = image_root
        self.transform = transform
        self.labels = sorted(frame["label"].unique())
        self.label_to_idx = {label: idx for idx, label in enumerate(self.labels)}

    def __len__(self) -> int:
        return len(self.frame)

    def __getitem__(self, index: int):
        row = self.frame.iloc[index]
        image = Image.open(self.image_root / row["path"]).convert("RGB")
        label = self.label_to_idx[row["label"]]
        return self.transform(image), label


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="CSV with 'path' and 'label' columns")
    parser.add_argument("--image-root", required=True)
    parser.add_argument("--output", default="app/ml/models/tagger.pt")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-4)
    args = parser.parse_args()

    df = pd.read_csv(args.data)
    assert "path" in df.columns and "label" in df.columns

    transform = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    dataset = TravelImageDataset(df, Path(args.image_root), transform)
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(dataset.labels))
    model.to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(args.epochs):
        model.train()
        total_loss = 0.0
        for images, labels in loader:
            images = images.to(device)
            labels = labels.to(device)
            logits = model(images)
            loss = criterion(logits, labels)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        logger.info("Epoch %d/%d - Loss: %.4f", epoch + 1, args.epochs, total_loss / len(loader))

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "labels": dataset.labels}, output_path)
    logger.info("Saved image tagger to %s", output_path)


if __name__ == "__main__":
    main()
