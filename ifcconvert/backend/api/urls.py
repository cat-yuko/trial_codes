from django.urls import path
from .views import ConvertIFCView

urlpatterns = [
    path("convert_ifc/", ConvertIFCView.as_view()),
]
