FROM rust:1.87-bookworm AS build
WORKDIR /app
COPY Cargo.toml ./
COPY Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
COPY --from=build /app/target/release/scope /usr/local/bin/scope
ENTRYPOINT ["scope"]
CMD ["--help"]
