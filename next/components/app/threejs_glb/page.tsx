"use client";

import { useState, useEffect, useRef } from "react";
import BuildingViewer from "@/app/components/BuildingViewer";
import UIControls from "@/app/components/UIControls";
import FileSelector from "@/app/components/FileSelector";

export default function Page() {
  // ファイルURL
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  // ノード
  const [nodes, setNodes] = useState<{ name: string; visible: boolean }[]>([]);
  // マテリアル
  const [materials, setMaterials] = useState<
    { name: string; visible: boolean }[]
  >([]);
  //
  const [controlParams, setControlParams] = useState({
    hiddenNodes: [] as string[],
    hiddenMaterials: [] as string[],
    outlinedMaterials: [] as string[],
    displayMode: "edges", // ← "wireframe" に切り替えるとワイヤーフレーム表示
  });

  return (
    <div
      className="w-screen h-screen flex flex-col bg-gray-100"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* メイン表示領域 */}
      <div className="flex-1 flex p-4 gap-4">
        {/* 左サイドバー */}
        <div
          className="w-64 bg-white p-4 rounded shadow overflow-auto"
          style={{ height: "calc(100vh - 6rem)" }}
        >
          <FileSelector onFileSelect={setFileUrl} />

          <UIControls
            controlParams={controlParams}
            setControlParams={setControlParams}
            nodes={nodes}
            materials={materials}
          />
        </div>

        {/* モデル表示エリア */}
        <div className="flex-1 bg-white rounded shadow">
          <BuildingViewer
            glbUrl={fileUrl}
            controlParams={controlParams}
            onNodesLoaded={setNodes}
            onMaterialsLoaded={setMaterials}
          />
        </div>
      </div>
    </div>
  );
}
