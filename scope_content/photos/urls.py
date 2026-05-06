from django.urls import path

from photos.views import photo_detail, presigned_url, upload_photo

urlpatterns = [
    path('upload', upload_photo),
    path('presigned-url', presigned_url),
    path('<uuid:pk>', photo_detail),
]
