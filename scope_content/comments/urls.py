from django.urls import path

from comments import views

urlpatterns = [
    path('', views.comments_collection, name='comments-collection'),
    path('<uuid:pk>/', views.comment_detail, name='comment-detail'),
    path('<uuid:pk>/replies/', views.comment_replies, name='comment-replies'),
]
