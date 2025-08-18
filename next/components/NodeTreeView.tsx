import { useState } from "react";

type Node = {
  id: string;
  name: string;
  children: Node[];
};

type Props = {
  nodes: Node[];
  hiddenNodes: string[];
  toggleNodeVisibility: (name: string) => void;
};

export default function NodeTreeView({
  nodes,
  hiddenNodes,
  toggleNodeVisibility,
}: Props) {
  return (
    <ul className="pl-4">
      {nodes.map((node) => (
        <NodeItem
          key={node.id}
          node={node}
          hiddenNodes={hiddenNodes}
          toggleNodeVisibility={toggleNodeVisibility}
        />
      ))}
    </ul>
  );
}

function NodeItem({
  node,
  hiddenNodes,
  toggleNodeVisibility,
}: {
  node: Node;
  hiddenNodes: string[];
  toggleNodeVisibility: (name: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isHidden = hiddenNodes.includes(node.name);

  return (
    <li>
      <div className="flex items-center space-x-2">
        {node.children.length > 0 && (
          <button
            onClick={() => setOpen(!open)}
            className="w-4 h-4 text-xs select-none"
          >
            {open ? "▼" : "▶"}
          </button>
        )}
        <input
          type="checkbox"
          checked={!isHidden}
          onChange={() => toggleNodeVisibility(node.name)}
        />
        <span>{node.name}</span>
      </div>
      {open && node.children.length > 0 && (
        <NodeTreeView
          nodes={node.children}
          hiddenNodes={hiddenNodes}
          toggleNodeVisibility={toggleNodeVisibility}
        />
      )}
    </li>
  );
}
