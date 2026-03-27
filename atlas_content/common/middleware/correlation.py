import uuid
class CorrelationIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    def __call__(self, request):
        request.correlation_id = request.headers.get('X-Correlation-Id', str(uuid.uuid4()))
        response = self.get_response(request)
        response['X-Correlation-Id'] = request.correlation_id
        return response
