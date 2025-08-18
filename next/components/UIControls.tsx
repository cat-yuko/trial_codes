"use client";

import NodeTreeView from "@/app/components/NodeTreeView";
import MaterialList from "@/app/components/MaterialList";

type Props = {
  controlParams: {
    hiddenNodes: string[];
    hiddenMaterials: string[]; // 透過対象マテリアル名リスト
    outlinedMaterials: string[]; // 白い枠線表示対象マテリアル名リスト
  };
  setControlParams: React.Dispatch<any>;
  nodes: {
    id: string;
    name: string;
    children: any[];
  }[];
  materials: {
    name: string;
  }[];
};

export default function UIControls({
  controlParams,
  setControlParams,
  nodes,
  materials,
}: Props) {
  const toggleNodeVisibility = (name: string) => {
    setControlParams((prev: any) => {
      const isHidden = prev.hiddenNodes.includes(name);
      return {
        ...prev,
        hiddenNodes: isHidden
          ? prev.hiddenNodes.filter((n: string) => n !== name)
          : [...prev.hiddenNodes, name],
      };
    });
  };

  // 透過切替トグル
  const toggleTransparency = (name: string) => {
    setControlParams((prev: any) => {
      const isHidden = prev.hiddenMaterials.includes(name);
      return {
        ...prev,
        hiddenMaterials: isHidden
          ? prev.hiddenMaterials.filter((n: string) => n !== name)
          : [...prev.hiddenMaterials, name],
      };
    });
  };

  // 白枠表示トグル
  const toggleOutline = (name: string) => {
    setControlParams((prev: any) => {
      const isOutlined = prev.outlinedMaterials.includes(name);
      return {
        ...prev,
        outlinedMaterials: isOutlined
          ? prev.outlinedMaterials.filter((n: string) => n !== name)
          : [...prev.outlinedMaterials, name],
      };
    });
  };

  return (
    <div className="mt-4 space-y-6">
      <div>
        <h2 className="font-bold text-lg mb-2">オブジェクト一覧</h2>
        <NodeTreeView
          nodes={nodes}
          hiddenNodes={controlParams.hiddenNodes}
          toggleNodeVisibility={toggleNodeVisibility}
        />
      </div>

      <h2 className="font-bold text-lg mb-2">マテリアル一覧</h2>
      <MaterialList
        title="透過切替"
        materials={materials}
        hiddenMaterials={controlParams.hiddenMaterials}
        toggleMaterialVisibility={toggleTransparency}
      />

      <MaterialList
        title="ワイヤーフレーム表示"
        materials={materials}
        hiddenMaterials={controlParams.outlinedMaterials}
        toggleMaterialVisibility={toggleOutline}
      />
    </div>
  );
}
