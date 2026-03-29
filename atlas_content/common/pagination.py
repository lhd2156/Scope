from __future__ import annotations

from datetime import datetime

from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPageNumberPagination(PageNumberPagination):
    page_size_query_param = 'pageSize'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            {
                'data': data,
                'meta': {
                    'page': self.page.number,
                    'pageSize': self.get_page_size(self.request),
                    'total': self.page.paginator.count,
                    'totalPages': self.page.paginator.num_pages,
                },
            }
        )


class FeedCursorPagination:
    page_size = 20
    cursor_query_param = 'cursor'

    def __init__(self):
        self.next_cursor: str | None = None
        self.previous_cursor: str | None = None

    def paginate_queryset(self, items, request):
        ordered_items = sorted(list(items), key=lambda item: item.created_at, reverse=True)
        cursor = request.query_params.get(self.cursor_query_param)

        if cursor:
            try:
                cursor_position = datetime.fromisoformat(cursor)
            except ValueError as exc:
                raise ValidationError({'cursor': 'Cursor must be a valid ISO-8601 timestamp'}) from exc
            ordered_items = [item for item in ordered_items if item.created_at < cursor_position]
            self.previous_cursor = cursor
        else:
            self.previous_cursor = None

        page = ordered_items[: self.page_size]
        self.next_cursor = page[-1].created_at.isoformat() if len(ordered_items) > self.page_size and page else None
        return page

    def get_paginated_response(self, data):
        return Response({'data': data, 'meta': {'nextCursor': self.next_cursor, 'previousCursor': self.previous_cursor}})
