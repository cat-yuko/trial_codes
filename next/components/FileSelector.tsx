"use client";

import { useState, useEffect, useRef } from "react";

type Props = {
  onFileSelect: (url: string) => void;
};

export default function FileSelector({ onFileSelect }: Props) {
  const prevUrlRef = useRef<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (file.type !== "model/gltf-binary" && !file.name.endsWith(".glb")) {
      alert("GLBファイルを選択してください");
      return;
    }
    const url = URL.createObjectURL(file);
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    prevUrlRef.current = url;
    onFileSelect(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`w-full h-32 border-2 border-dashed rounded-md flex items-center justify-center cursor-pointer transition-colors
        ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50"
        }
      `}
    >
      <label className="w-full h-full flex items-center justify-center text-gray-600">
        <input
          type="file"
          accept=".glb"
          onChange={handleFileChange}
          className="hidden"
        />
        {isDragging
          ? "ここにドロップ"
          : "クリックまたはドロップしてGLBファイルを選択"}
      </label>
    </div>
  );
}
