FROM certbot/certbot:v5.6.0@sha256:0107d084c225631fc64a8313e19adb07275f7296fde338f7dfa93986c80b2e3e

RUN python -m pip install --no-cache-dir --upgrade urllib3==2.7.0 \
    && rm -f /usr/local/bin/uv /usr/local/bin/uvx

USER 101:101
