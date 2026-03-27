from collections import defaultdict, deque
from time import time
from rest_framework.response import Response
_BUCKETS = defaultdict(deque)
class RateLimitMiddleware:
    WINDOW_SECONDS = 60
    GLOBAL_LIMIT = 100
    UPLOAD_LIMIT = 20
    def __init__(self, get_response):
        self.get_response = get_response
    def __call__(self, request):
        identity = str(getattr(getattr(request, 'user', None), 'id', request.META.get('REMOTE_ADDR', 'anon')))
        limit = self.UPLOAD_LIMIT if request.path.startswith('/api/content/photos/upload') else self.GLOBAL_LIMIT
        segment = request.path.split('/')[3] if request.path.startswith('/api/') and len(request.path.split('/')) > 3 else request.path
        key = f'{identity}:{segment}'
        now = time()
        bucket = _BUCKETS[key]
        while bucket and now - bucket[0] > self.WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= limit:
            return Response({'error': {'code': 'RATE_LIMITED', 'message': 'Too many requests', 'details': [], 'traceId': getattr(request, 'correlation_id', None)}}, status=429, headers={'Retry-After': str(self.WINDOW_SECONDS)})
        bucket.append(now)
        return self.get_response(request)
