from django.shortcuts import render

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.middleware import csrf
from django.conf import settings
from .serializers import CustomTokenObtainPairSerializer
import logging

logger = logging.getLogger(__name__)

class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            refresh = serializer.validated_data['refresh']
            access = serializer.validated_data['access']

            # クッキーにトークンをセット
            max_age = settings.COOKIE_TIME
            # 本番環境では True
            secure = not settings.DEBUG

            response.set_cookie('access_token', access, httponly=True, secure=secure, samesite='Lax', max_age=max_age)
            response.set_cookie('refresh_token', refresh, httponly=True, secure=secure, samesite='Lax', max_age=max_age)
            response.set_cookie('csrftoken', csrf.get_token(request), samesite='Lax', max_age=max_age)
            return response
        
        except Exception as e:
            logger.error(f"Login error: {e}", exc_info=True)
            return Response({"detail": "Login failed."}, status=status.HTTP_401_UNAUTHORIZED)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "id": request.user.id,
            'email': request.user.email,
            "username": request.user.username,
            "role": getattr(request.user, "role", "user"),
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args):
        response = Response({"message": "logout success"}, status=status.HTTP_200_OK)
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response


class CookieTokenRefreshView(APIView):
    def post(self, request):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh_token = request.COOKIES.get('refresh_token')
        if not refresh_token:
            return Response({"error": "リフレッシュトークンがありません"}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            refresh = RefreshToken(refresh_token)
            new_access = str(refresh.access_token)
            response = Response({"access": new_access})
            
            # 本番環境では True
            secure = not settings.DEBUG

            response.set_cookie('access_token', new_access, httponly=True, secure=secure, samesite='Lax')
            return response
        except Exception:
            return Response({"error": "無効なリフレッシュトークンです"}, status=status.HTTP_401_UNAUTHORIZED)
