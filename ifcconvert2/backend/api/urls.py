from django.urls import path
from .views import convert_ifc

urlpatterns = [
    path("convert_ifc/", convert_ifc, name="convert_ifc"),
]
