import { GizmoHelper, GizmoViewcube, OrbitControls, Stage } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { solidToThree } from '@tscad/modeling/convert';
import { useMemo } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Solid = any;

function Entities({ model }: { model: Solid | Solid[] }) {
  const geometries = useMemo(
    () => (Array.isArray(model) ? model : [model]).map((solid) => solidToThree(solid)),
    [model],
  );

  return (
    <>
      {geometries.map((geometry, index) => (
        // eslint-disable-next-line react/no-unknown-property
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
