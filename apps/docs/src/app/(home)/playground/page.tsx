import { PlaygroundEditor, PlaygroundPreview, PlaygroundProvider, State } from './page.client';

export default function PlaygroundPage() {
  const moduleTypes = [
    {
      moduleName: '@tscad/modeling/primitives',
      source: `export type Vector3 = [number, number, number];

    /** Options used in the {@link cube} method. */
    interface CubeOptions {
      /** Center of the cube @default [0, 0, 0] */
      center?: Vector3;
      /** Size of the cube @default 2 */
      size?: number;
    }
    /**
     * Construct an axis-aligned solid cube in three dimensional space with six square faces.
     * @see https://tscad.vercel.app/docs/primitives/cube
     */
    export function cube(options: CubeOptions): void;

    /** @deprecated Not typed yet.... */
    export function sphere(options: any): void`,
    },
  ];

  return (
    <PlaygroundProvider>
      <State />

      <div className="h-[calc(100vh-var(--fd-nav-height))] flex">
        <div className="flex-1">
          <PlaygroundEditor moduleTypes={moduleTypes} />
        </div>
        <div className="flex-1">
          <PlaygroundPreview />
        </div>
      </div>
    </PlaygroundProvider>
  );
}
