from django.urls import path
from . import views

urlpatterns = [
    path('token/', views.LoginView.as_view(), name='token_obtain'),
    path('token/refresh/', views.CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('me/', views.MeView.as_view(), name='me'),
]
