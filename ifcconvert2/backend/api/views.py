from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from pathlib import Path
from .ifc_splitter import split_ifc_by_storey
from .tasks import convert_ifc_to_glb
import os

@csrf_exempt
def convert_ifc(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=400)

    uploaded_file = request.FILES["ifc_file"]
    input_path = Path(settings.MEDIA_ROOT) / "uploads" / uploaded_file.name
    input_path.parent.mkdir(parents=True, exist_ok=True)
    with open(input_path, "wb") as f:
        for chunk in uploaded_file.chunks():
            f.write(chunk)

    # 階層ごとに分割
    split_dir = Path(settings.MEDIA_ROOT) / "split"
    split_files = split_ifc_by_storey(str(input_path), str(split_dir))

    # GLB変換をCeleryで並列実行
    glb_urls = []
    glb_dir = Path(settings.MEDIA_ROOT) / "converted"
    glb_dir.mkdir(parents=True, exist_ok=True)

    for split_file in split_files:
        name = Path(split_file).stem
        glb_path = glb_dir / f"{name}.glb"
        convert_ifc_to_glb.delay(str(split_file), str(glb_path))
        glb_urls.append(os.path.join(settings.MEDIA_URL, "converted", f"{name}.glb"))

    return JsonResponse({"glb_files": glb_urls})
