"use client";

export default function Page() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center space-y-6">
      <h1 className="text-2xl font-bold">Tailwind + clamp() テスト</h1>
      <p className="text-body border p-fluid">
        画面幅を変えるとこの文字が滑らかに大きさを変えます。
      </p>
      <p className="text-body border p-fluid-lg">
        画面幅を変えるとこの文字が滑らかに大きさを変えます。
      </p>
      <p className="text-sm">比較用: text-sm (固定サイズ)</p>
    </main>
  );
}
