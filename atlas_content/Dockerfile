FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
ARG DJANGO_SECRET_KEY=atlas-content-build-placeholder
ARG CORE_JWT_SECRET=atlas-content-build-jwt-placeholder
ARG FRONTEND_ORIGIN=http://localhost
ENV DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY
ENV CORE_JWT_SECRET=$CORE_JWT_SECRET
ENV FRONTEND_ORIGIN=$FRONTEND_ORIGIN
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python manage.py collectstatic --noinput
EXPOSE 8000
HEALTHCHECK CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/content/health')"
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
