import { useMemo } from 'react';
import { solidToThree } from '@tscad/modeling/convert';
import { Canvas } from '@react-three/fiber';
import { GizmoHelper, GizmoViewcube, OrbitControls, Stage } from '@react-three/drei';

type Solid = any;

function Entities({ model }: { model: Solid | Solid[] }) {
  const geometries = useMemo(
    () => (Array.isArray(model) ? model : [model]).map((solid) => solidToThree(solid)),
    [model],
  );

  return (
    <>
      {geometries.map((geometry, index) => (
        <mesh key={index} castShadow geometry={geometry}>
          <meshStandardMaterial color="orange" />
        </mesh>
      ))}
    </>
  );
}

export default function Viewer({ model }: { model: Solid | Solid[] }) {
  return (
    <Canvas shadows camera={{ position: [25, 25, 50] }}>
      <OrbitControls makeDefault />

      <Stage adjustCamera environment="city" center={{ precise: true }}>
        <Entities model={model} />

        <GizmoHelper>
          <GizmoViewcube />
        </GizmoHelper>
      </Stage>
    </Canvas>
  );
}
