#!/usr/bin/env python3

# -----------------------------------------------------
# 実行方法
# python3 split_ifc_by_storey.py input.ifc output_dir/
# -----------------------------------------------------

import sys
import os
import ifcopenshell
import ifcopenshell.util.element

def collect_related_objects(model, product, collected):
    """再帰的に関連要素・スタイルを収集"""
    if product in collected:
        return
    collected.add(product)

    # 材料・スタイル追跡
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

def export_storey(model, storey, output_dir):
    """指定階層を抽出して新しいIFCに保存"""
    storey_name = storey.Name or f"Storey_{storey.id()}"
    safe_name = "".join(c if c.isalnum() else "_" for c in storey_name)
    output_path = os.path.join(output_dir, f"floor_{safe_name}.ifc")

    new_model = ifcopenshell.file(schema=model.schema)
    collected = set()
    collect_related_objects(model, storey, collected)

    # 階層内の要素を収集
    for rel in getattr(storey, "ContainsElements", []) or []:
        for elem in rel.RelatedElements:
            collect_related_objects(model, elem, collected)

    # 参照付きで追加
    for elem in collected:
        try:
            new_model.add(elem)
        except Exception:
            continue

    new_model.write(output_path)
    print(f"✅ Exported: {output_path}  (objects: {len(collected)})")


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 split_ifc_by_storey.py <input.ifc> <output_dir>")
        sys.exit(1)

    input_ifc = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"📂 Loading IFC: {input_ifc}")
    model = ifcopenshell.open(input_ifc)

    storeys = model.by_type("IfcBuildingStorey")
    if not storeys:
        print("❌ No IfcBuildingStorey found in this IFC file.")
        sys.exit(0)

    print(f"🏗 Found {len(storeys)} storeys.")
    for storey in storeys:
        export_storey(model, storey, output_dir)

    print("🎉 All storeys exported successfully.")


if __name__ == "__main__":
    main()
