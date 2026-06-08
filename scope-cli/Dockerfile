FROM rust:1.87-bookworm@sha256:251cec8da4689d180f124ef00024c2f83f79d9bf984e43c180a598119e326b84 AS build
WORKDIR /app
COPY Cargo.toml ./
COPY Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM debian:bookworm-slim@sha256:0104b334637a5f19aa9c983a91b54c89887c0984081f2068983107a6f6c21eeb
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10006 scope \
    && useradd --system --uid 10006 --gid scope --home-dir /workspace --shell /usr/sbin/nologin scope
WORKDIR /workspace
COPY --from=build /app/target/release/scope /usr/local/bin/scope
USER scope
ENTRYPOINT ["scope"]
CMD ["--help"]
