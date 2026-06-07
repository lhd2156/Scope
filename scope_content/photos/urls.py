from django.urls import path

from photos.views import photo_content, photo_detail, presigned_url, upload_photo

urlpatterns = [
    path('upload', upload_photo),
    path('presigned-url', presigned_url),
    path('<uuid:pk>/content', photo_content, name='photo-content'),
    path('<uuid:pk>', photo_detail),
]
