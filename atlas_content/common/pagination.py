from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.response import Response
class StandardPageNumberPagination(PageNumberPagination):
    page_size_query_param = 'pageSize'
    max_page_size = 100
    def get_paginated_response(self, data):
        return Response({'data': data, 'meta': {'page': self.page.number, 'pageSize': self.get_page_size(self.request), 'total': self.page.paginator.count, 'totalPages': self.page.paginator.num_pages}})
class FeedCursorPagination(CursorPagination):
    page_size = 20
    ordering = '-created_at'
    cursor_query_param = 'cursor'
    def get_paginated_response(self, data):
        return Response({'data': data, 'meta': {'nextCursor': self.get_next_link(), 'previousCursor': self.get_previous_link()}})
