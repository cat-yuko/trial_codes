from rest_framework.views import APIView
from rest_framework.response import Response
from django.core.files.storage import default_storage
from .tasks import convert_ifc_task
import os

class ConvertIFCView(APIView):
    def post(self, request):
        ifc_file = request.FILES.get("ifc_file")
        if not ifc_file:
            return Response({"error": "No IFC file provided"}, status=400)

        filename = default_storage.save(f"uploads/{ifc_file.name}", ifc_file)
        basename, _ = os.path.splitext(os.path.basename(filename))

        task = convert_ifc_task.delay(filename, basename)
        return Response({"task_id": task.id}, status=202)
