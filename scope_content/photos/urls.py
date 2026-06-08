from django.urls import path

from photos.views import avatar_content, photo_content, photo_detail, presigned_url, upload_avatar, upload_photo

urlpatterns = [
    path('upload', upload_photo),
    path('presigned-url', presigned_url),
    path('avatar-upload', upload_avatar),
    path('avatar/content', avatar_content),
    path('<uuid:pk>/content', photo_content, name='photo-content'),
    path('<uuid:pk>', photo_detail),
]
