from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # 表示用
        token['username'] = user.username
        # ロール情報をトークンに追加
        token['role'] = user.role
        return token
