import { type ThreeElements } from '@react-three/fiber';
import type { Solid } from '@tscad/modeling';
import { solidToThree } from '@tscad/modeling/convert';
import { createContext, useContext, useMemo } from 'react';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

// FIXME [>=1.0.0]: Get from viewer settings context
const defaultColor: string = 'orange';

const RenderedSolidsContext = createContext<{ solids?: Solid[] }>({});

export const RenderedSolidsProvider = RenderedSolidsContext.Provider;
export const useRenderedSolids = () => useContext(RenderedSolidsContext);

export function RenderedSolids() {
  const { solids } = useRenderedSolids();

  const geometries = useMemo(() => {
    return (solids ?? []).map((solid) => solidToThree(solid));
  }, [solids]);

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
