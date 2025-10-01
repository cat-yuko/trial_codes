from rest_framework_simplejwt.authentication import JWTAuthentication

class AccessJWTAuthentication(JWTAuthentication):
    def get_header(self, request):
        print(">>> Incoming COOKIES:", request.COOKIES)
        token = request.COOKIES.get('access_token')
        print(">>> access_token from cookie:", token)
        if token is None:
            return None
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {token}'
        return super().get_header(request)


class RefreshJWTAuthentication(JWTAuthentication):
    def get_header(self, request):
        refresh = request.COOKIES.get('refresh_token')
        if refresh:
            request.META['HTTP_AUTHORIZATION'] = f'Bearer {refresh}'
        return super().get_header(request)
