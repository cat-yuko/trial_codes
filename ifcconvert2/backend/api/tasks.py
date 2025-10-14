from celery import shared_task
import subprocess

@shared_task
def convert_ifc_to_glb(ifc_path, output_path):
    cmd = ["IfcConvert", ifc_path, output_path]
    subprocess.run(cmd, check=True)
    return output_path
