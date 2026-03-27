#!/usr/bin/env sh
set -eu

BOOTSTRAP_SERVER="${KAFKA_BOOTSTRAP_SERVERS:-kafka:9092}"
TOPICS="${ATLAS_KAFKA_TOPICS:-spot.created trip.created itinerary.requested itinerary.generated notification.created}"

printf 'Creating Kafka topics on %s\n' "$BOOTSTRAP_SERVER"

for topic in $TOPICS; do
  kafka-topics --bootstrap-server "$BOOTSTRAP_SERVER" \
    --create \
    --if-not-exists \
    --topic "$topic" \
    --replication-factor 1 \
    --partitions 1
  printf 'Ensured topic exists: %s\n' "$topic"
done
