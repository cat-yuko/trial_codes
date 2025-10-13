import os
import subprocess
from celery import shared_task
from django.conf import settings

@shared_task
def convert_ifc_task(ifc_path, output_basename):
    media_dir = settings.MEDIA_ROOT
    output_dir = os.path.join(media_dir, "converted")
    os.makedirs(output_dir, exist_ok=True)

    ifc_full = os.path.join(media_dir, ifc_path)

    gltf_path = os.path.join(output_dir, f"{output_basename}.glb")
    obj_path = os.path.join(output_dir, f"{output_basename}.obj")
    fbx_path = os.path.join(output_dir, f"{output_basename}.fbx")

    docker_cmd = "docker exec ifcopenshell IfcConvert"

    try:
        subprocess.run(f"{docker_cmd} /media/{ifc_path} /media/converted/{output_basename}.glb", shell=True, check=True)
        subprocess.run(f"{docker_cmd} /media/{ifc_path} /media/converted/{output_basename}.obj", shell=True, check=True)
        subprocess.run(f"{docker_cmd} /media/{ifc_path} /media/converted/{output_basename}.fbx", shell=True, check=True)
    except subprocess.CalledProcessError as e:
        return {"status": "error", "message": str(e)}

    return {
        "status": "success",
        "gltf": f"/media/converted/{output_basename}.glb",
        "obj": f"/media/converted/{output_basename}.obj",
        "fbx": f"/media/converted/{output_basename}.fbx",
    }
