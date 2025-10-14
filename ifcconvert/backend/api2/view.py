from .tasks import split_and_convert_all

ifc_path = "/data/input_building.ifc"
output_dir = "/data/output_glb"

# 非同期で実行
task_result = split_and_convert_all.delay(ifc_path, output_dir)

# 必要に応じて状態確認
print("Task ID:", task_result.id)
