from django.http import JsonResponse
from django.conf import settings
from pathlib import Path
from .tasks import convert_ifc_to_glb
import os

def start_ifc_conversion(request):
    ifc_path = Path(settings.MEDIA_ROOT) / "uploads" / "example.ifc"
    output_dir = Path(settings.MEDIA_ROOT) / "converted"
    output_dir.mkdir(parents=True, exist_ok=True)

    # 仮：IFCを階層ごとに分割してリスト化
    storeys = ["floor1", "floor2", "floor3"]

    # Celery並列変換
    for storey in storeys:
        convert_ifc_to_glb.delay(str(ifc_path), str(output_dir), storey)

    return JsonResponse({"status": "started"})


def conversion_result(request):
    output_dir = Path(settings.MEDIA_ROOT) / "converted"
    glb_files = [
        os.path.join(settings.MEDIA_URL, f.name)
        for f in sorted(output_dir.glob("*.glb"))
    ]
    return JsonResponse({"glb_files": glb_files})
  
