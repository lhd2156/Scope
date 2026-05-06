from django.apps import AppConfig


class CommonConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'common'

    def ready(self):
        import os
        import sys

        from common.search import ensure_indexes

        ensure_indexes()

        if os.environ.get("GRPC_ENABLED", "true").lower() != "true":
            return
        if any(command in sys.argv for command in ["migrate", "makemigrations", "collectstatic", "pytest"]):
            return
        if "gunicorn" not in sys.argv[0] and "runserver" not in sys.argv:
            return

        from common.grpc_server import start_grpc_background

        start_grpc_background()
