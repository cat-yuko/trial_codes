#!/usr/bin/env python3

# -----------------------------------------------------
# 実行方法
# python3 split_ifc_by_storey_and_type.py input.ifc output/
# -----------------------------------------------------


import sys
import os
import ifcopenshell
import ifcopenshell.util.element

# === 🔧 設定項目 ===
# 分割したい要素タイプ（部分一致でもOK）
TARGET_CLASSES = ["IfcWall", "IfcWallStandardCase", "IfcDoor", "IfcWindow"]

def collect_related_objects(model, product, collected):
    """再帰的に関連要素・スタイルを収集"""
    if product in collected:
        return
    collected.add(product)

    # スタイル付き項目
    try:
        styled_items = ifcopenshell.util.element.get_styled_items(product)
        for item in styled_items:
            collected.add(item)
            if getattr(item, "Styles", None):
                for s in item.Styles:
                    collected.add(s)
    except Exception:
        pass

    # 子要素（分解構造）
    try:
        for sub in ifcopenshell.util.element.get_decomposition(product):
            collect_related_objects(model, sub, collected)
    except Exception:
        pass


def export_storey(model, storey, elements, suffix, output_dir):
    """指定階層＋要素グループをIFCとして保存"""
    storey_name = storey.Name or f"Storey_{storey.id()}"
    safe_name = "".join(c if c.isalnum() else "_" for c in storey_name)
    output_path = os.path.join(output_dir, f"{safe_name}_{suffix}.ifc")

    new_model = ifcopenshell.file(schema=model.schema)
    collected = set()
    collect_related_objects(model, storey, collected)

    for elem in elements:
        collect_related_objects(model, elem, collected)

    for elem in collected:
        try:
            new_model.add(elem)
        except Exception:
            continue

    new_model.write(output_path)
    print(f"✅ Exported: {output_path}  (objects: {len(collected)})")


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 split_ifc_by_storey_and_type.py <input.ifc> <output_dir>")
        sys.exit(1)

    input_ifc = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"📂 Loading IFC: {input_ifc}")
    model = ifcopenshell.open(input_ifc)

    storeys = model.by_type("IfcBuildingStorey")
    if not storeys:
        print("❌ No IfcBuildingStorey found.")
        sys.exit(0)

    for storey in storeys:
        all_elements = []
        target_elements = []
        other_elements = []

        # 各階層の要素を取得
        for rel in getattr(storey, "ContainsElements", []) or []:
            for elem in rel.RelatedElements:
                all_elements.append(elem)
                elem_type = elem.is_a()
                if any(t in elem_type for t in TARGET_CLASSES):
                    target_elements.append(elem)
                else:
                    other_elements.append(elem)

        print(f"🏢 {storey.Name}: {len(target_elements)} target / {len(other_elements)} others")

        if target_elements:
            export_storey(model, storey, target_elements, "target", output_dir)
        if other_elements:
            export_storey(model, storey, other_elements, "other", output_dir)

    print("🎉 Export completed for all storeys and element types.")


if __name__ == "__main__":
    main()
