# ifc_splitter.py
import ifcopenshell
import ifcopenshell.api
from pathlib import Path

def split_ifc_by_storey(ifc_path: str, output_dir: str):
    """
    IFCを階層ごとに自動分割する
    例: floor1.ifc, floor2.ifc, floor3.ifc
    """
    file = ifcopenshell.open(ifc_path)
    storeys = file.by_type("IfcBuildingStorey")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    output_files = []

    for storey in storeys:
        storey_name = storey.Name or "UnknownStorey"
        storey_name = storey_name.replace(" ", "_")
        new_file = ifcopenshell.file(schema=file.schema)

        # Storey内の要素を取得
        related_elements = []
        for rel in file.get_inverse(storey):
            if rel.is_a("IfcRelContainedInSpatialStructure"):
                related_elements.extend(rel.RelatedElements)

        # Storey自体とその要素をコピー
        new_file.add(storey)
        for elem in related_elements:
            new_file.add(elem)

        output_path = output_dir / f"{storey_name}.ifc"
        new_file.write(str(output_path))
        output_files.append(str(output_path))

    return output_files
