import { GizmoHelper, GizmoViewcube, OrbitControls, Stage } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { type ThreeElements } from '@react-three/fiber';
import type { Model, ParametersInput, Solid } from '@tscad/modeling';
import { solidToThree } from '@tscad/modeling/convert';
import type { JSONSchema } from 'json-schema-to-ts';
import { Leva, useControls } from 'leva';
import type { Schema } from 'leva/dist/declarations/src/types';
import { type ComponentProps, type ReactNode, useEffect, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useDebouncedState } from './hooks/use-debounced';

const defaultColor = 'orange';

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

export function RenderedSolids({ solid }: { solid: Solid | Solid[] }) {
  const geometries = useMemo(() => {
    return (Array.isArray(solid) ? solid : [solid]).map((solid) => solidToThree(solid));
  }, [solid]);

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

export function Entities<P>({
  model,
  parameters,
}: {
  model: Model<ParametersInput, P>;
  parameters: P;
}) {
  // FIXME [>=1.0.0]: Run in worker
  const solids = useMemo(() => model.render(parameters).solids, [model, parameters]);

  return <RenderedSolids solid={solids} />;
}

type LevaProperties = ComponentProps<typeof Leva>;

const defaultLevaProperties: LevaProperties = {
  titleBar: { title: 'Options' },
};

export function jsonSchemaToLevaInputOptions(schema: Exclude<JSONSchema, boolean>, value: unknown) {
  return {
    type: ((schema.type as string) ?? 'string').toUpperCase(),
    min: schema.minimum,
    max: schema.maximum,
    step: 1,
    default: schema.default,
    value,
    // TODO [>=1.0.0]: Add tooltip provider and enable
    // hint: schema.description,
  } as Schema[string];
}

export function jsonSchemaToLevaSchema(
  schema: ParametersInput,
  defaults: Record<string, unknown>,
): Schema {
  return Object.fromEntries(
    (
      Object.entries(schema ?? {}) as [
        string,
        Exclude<NonNullable<typeof schema>[string], boolean>,
      ][]
    ).map(([key, schema]) => [key, jsonSchemaToLevaInputOptions(schema, defaults[key])]),
  );
}

function parametersToLevaSchema(model: Model<ParametersInput, Record<string, unknown>>): Schema {
  const defaults = model.resolveParameters({}, false);

  return jsonSchemaToLevaSchema(model.parametersSchema, defaults);
}

export const useModelControls = <P extends Record<string, unknown>>(
  model: Model<ParametersInput, P>,
): P => {
  return useControls(parametersToLevaSchema(model)) as P;
};

export function ViewerProvider() {}

export function ViewerCanvas({
  children,
  viewcube = true,
  ...canvasProperties
}: { children: ReactNode; viewcube?: boolean } & ComponentProps<typeof Canvas>) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="text-muted-foreground flex h-full w-full flex-1 flex-col items-center justify-center">
          <p>Something went wrong while rendering the model</p>
          <pre>{error.message}</pre>
          <button onClick={resetErrorBoundary}>reload</button>
        </div>
      )}
      onReset={() => {
        globalThis.location.reload();
      }}
    >
      <Canvas shadows camera={{ position: [25, 25, 50] }} {...canvasProperties}>
        <OrbitControls makeDefault />

        <Stage environment="studio" adjustCamera center={{ precise: true }}>
          {children}

          {viewcube && (
            <GizmoHelper>
              <GizmoViewcube />
            </GizmoHelper>
          )}
        </Stage>
      </Canvas>
    </ErrorBoundary>
  );
}

export default function Viewer<S extends ParametersInput, P extends Record<string, unknown>>({
  model,
  children,
  viewcube = true,
  leva = {},
}: {
  model: Model<S, P>;
  viewcube?: boolean;
  children?: ReactNode;
  leva?: LevaProperties;
}) {
  const parameters = useModelControls(model);

  // Debounce parameter changes to avoid excessive re-renders
  const [debouncedParameters, setDebouncedParameters] = useDebouncedState(parameters, 100);
  useEffect(() => setDebouncedParameters(parameters), [parameters, setDebouncedParameters]);

  return (
    <>
      <Leva {...defaultLevaProperties} {...leva} />

      <ViewerCanvas
        viewcube={viewcube}
        style={{
          transition: 'opacity 0.1s ease-in-out',
          opacity: parameters === debouncedParameters ? 1 : 0.5,
        }}
      >
        <Entities model={model} parameters={debouncedParameters} />

        {children}
      </ViewerCanvas>
    </>
  );
}
