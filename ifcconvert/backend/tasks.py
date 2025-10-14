from celery import shared_task, group
import ifcopenshell
import subprocess
import os
from pathlib import Path


@shared_task
def convert_storey(ifc_path, storey_name, output_dir):
    """
    特定の階層(IFC BuildingStorey)を部分変換
    """
    model = ifcopenshell.open(ifc_path)
    storeys = model.by_type("IfcBuildingStorey")
    target = next((s for s in storeys if s.Name == storey_name), None)
    if not target:
        raise ValueError(f"Storey '{storey_name}' not found in IFC")

    # 新しい IFCファイルを作成
    new_model = ifcopenshell.file(schema=model.schema)
    related = model.get_decomposition(target)
    for e in related:
        new_model.add(e)

    tmp_ifc = Path(output_dir) / f"{storey_name}.ifc"
    new_model.write(str(tmp_ifc))

    # IfcConvert 実行
    glb_path = tmp_ifc.with_suffix(".glb")
    cmd = ["IfcConvert", str(tmp_ifc), str(glb_path)]
    subprocess.run(cmd, check=True)

    return str(glb_path)


@shared_task
def split_and_convert_all(ifc_path, output_dir):
    """
    IFCを階層ごとに分割 → 各階層を並列変換
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    model = ifcopenshell.open(ifc_path)
    storeys = model.by_type("IfcBuildingStorey")

    # 各階層をCeleryタスクとして並列実行
    tasks = [
        convert_storey.s(ifc_path, storey.Name, output_dir)
        for storey in storeys
    ]

    job = group(tasks)
    result = job.apply_async()

    return result.get()  # GLBパスのリストを返す
