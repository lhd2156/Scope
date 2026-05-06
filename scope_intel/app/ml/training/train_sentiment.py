"""Fine-tune DistilBERT for review sentiment on Scope data.

Usage:
    python -m app.ml.training.train_sentiment --data reviews.csv --output app/ml/models/sentiment
"""

import argparse
import inspect
import logging

import pandas as pd
from datasets import Dataset
from transformers import AutoModelForSequenceClassification, AutoTokenizer, Trainer, TrainingArguments

logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="CSV with 'text' and 'label' columns")
    parser.add_argument("--output", default="app/ml/models/sentiment")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=2e-5)
    args = parser.parse_args()

    df = pd.read_csv(args.data)
    assert "text" in df.columns and "label" in df.columns

    model_name = "distilbert-base-uncased-finetuned-sst-2-english"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)

    dataset = Dataset.from_pandas(df)
    dataset = dataset.map(
        lambda x: tokenizer(x["text"], truncation=True, padding="max_length", max_length=128),
        batched=True,
    )
    dataset = dataset.train_test_split(test_size=0.2)

    training_args_kwargs = {
        "output_dir": args.output,
        "num_train_epochs": args.epochs,
        "per_device_train_batch_size": args.batch_size,
        "per_device_eval_batch_size": args.batch_size,
        "learning_rate": args.lr,
        "save_strategy": "epoch",
        "load_best_model_at_end": True,
        "logging_steps": 50,
    }
    strategy_arg = "evaluation_strategy"
    if "evaluation_strategy" not in inspect.signature(TrainingArguments.__init__).parameters:
        strategy_arg = "eval_strategy"
    training_args_kwargs[strategy_arg] = "epoch"

    training_args = TrainingArguments(**training_args_kwargs)

    trainer = Trainer(model=model, args=training_args, train_dataset=dataset["train"], eval_dataset=dataset["test"])
    trainer.train()
    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)
    logger.info("Saved fine-tuned model to %s", args.output)


if __name__ == "__main__":
    main()
