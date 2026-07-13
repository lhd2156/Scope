FROM certbot/certbot:v5.7.0@sha256:6bb19cff0b3972a69855686e0ccbd20b98dbfae2aa43845a5df48947ba1401b4

RUN python -m pip install --no-cache-dir --upgrade urllib3==2.7.0 \
    && rm -f /usr/local/bin/uv /usr/local/bin/uvx

USER 101:101
