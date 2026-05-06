from scope_content.celery import app as _celery_app

celery_app = _celery_app

__all__ = ('celery_app',)
