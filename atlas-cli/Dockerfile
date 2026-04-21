FROM rust:1.87-bookworm AS build
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY --from=build /app/target/release/atlas /usr/local/bin/atlas
ENTRYPOINT ["atlas"]
CMD ["--help"]
