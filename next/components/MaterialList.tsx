type Material = {
  name: string;
};

type Props = {
  title: string;
  materials: Material[];
  hiddenMaterials: string[];
  toggleMaterialVisibility: (name: string) => void;
};

export default function MaterialList({
  title,
  materials,
  hiddenMaterials,
  toggleMaterialVisibility,
}: Props) {
  return (
    <div>
      <h3 className="font-bold mb-2">{title}</h3>
      <ul>
        {materials.map((mat) => {
          const isHidden = hiddenMaterials.includes(mat.name);
          return (
            <li key={mat.name} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isHidden}
                onChange={() => toggleMaterialVisibility(mat.name)}
              />
              <span>{mat.name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
