import { GizmoHelper, GizmoViewcube, OrbitControls, Stage } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { Model } from '@tscad/modeling';
import { solidToThree } from '@tscad/modeling/convert';
import { type ReactNode, useMemo } from 'react';

const defaultColor = 'orange';

function Entities({ model }: { model: Model }) {
  const geometries = useMemo(
    () => (Array.isArray(model) ? model : [model]).map((solid) => solidToThree(solid)),
    [model],
  );

  return (
    <>
      {geometries.map(({ geometry, material }, index) => (
        // eslint-disable-next-line react/no-unknown-property
        <mesh key={index} castShadow geometry={geometry}>
          <meshStandardMaterial {...material} color={material.color ?? defaultColor} />
        </mesh>
      ))}
    </>
  );
}

export default function Viewer({
  model,
  children,
  viewcube = true,
}: {
  model: Model;
  viewcube?: boolean;
  children?: ReactNode;
}) {
  return (
    <Canvas shadows camera={{ position: [25, 25, 50] }}>
      <OrbitControls makeDefault />

      <Stage adjustCamera environment="city" center={{ precise: true }}>
        <Entities model={model} />

        {viewcube && (
          <GizmoHelper>
            <GizmoViewcube />
          </GizmoHelper>
        )}

        {children}
      </Stage>
    </Canvas>
  );
}
