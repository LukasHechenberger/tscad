# AST Package — Design Exploration Notes

The core idea: treat a 3D model as an AST (like a compiler IR), so different consumers (renderer, slicer, exporter) can each walk the tree and extract what they need, rather than coupling all logic into a single monolithic model object.

---

## Iteration 1 — Generic node registry (`src__/`)

Built a `createNodeRegistry()` helper that lets you register node types at runtime and builds a discriminated union dynamically. Used a toy `BinaryExpression / Literal / Identifier` AST as a proof of concept.

```ts
const registry = createNodeRegistry();
const Literal = registry.defineNode({ type: 'Literal', shape: { value: z.string() } });
```

Included a typed `TransformMap` (keyed by node `type`) and an `applyTransforms` walker. The registry pattern was appealing for extensibility but felt over-engineered — the dynamic union made types harder to work with and the indirection wasn't buying much.

---

## Iteration 2 — Generic children-based tree (`src_/disc.ts`)

Tried making every node carry optional `children` via `z.intersection`:

```ts
const CoreNode = z.intersection(_CoreNode, z.object({ children: z.array(_CoreNode).optional() }));
```

The goal was a single recursive tree shape where any node could have children. Problem: the `children` array being untyped made it hard to express "a union can only have solid children" etc. Also `z.intersection` with discriminated unions causes Zod pain.

---

## Iteration 3 — `z.codec` for tree-to-tree transforms (`src_/types.ts`, `src_/nodes/types.ts`)

Explored using Zod's `z.codec` to formally describe the transformation between a `modeling` layer and a `core` layer (like an IR lowering pass in a compiler):

```ts
const modelNodeCodec = z.codec(modelNode, coreNode, {
  decode(value) { return { type: '@tscad/core/model', data: { parametersJsonSchema: value.data.parametersZodSchema.toJSONSchema() } }; },
  encode() { throw new Error('Encoding not supported'); },
});
```

Also tried a `createTransformer` that wraps a per-node codec in a recursive `{ node, children }` tree walker. The `z.codec` API was ergonomic for single-node transforms but the recursive tree structure needed manual wiring and the `{ node, children }` envelope felt awkward — separating the node from its children rather than having them inline.

---

## Iteration 4 — `data` envelope + branded nodes (`src_/nodes/modeling.ts`)

Tried wrapping node payloads in a `data` key and using `.brand()` for nominal typing:

```ts
const cuboidSchema = z.object({ type: z.literal('cuboid'), data: { size: ... } }).brand('CuboidNode');
const cubeSchema = z.codec(CubeNode, CuboidNode, { decode: ..., encode: ... });
```

The `cube -> cuboid` codec made the "sugar helper normalises to canonical form" idea explicit. But the `data` envelope added noise everywhere and the codec round-trip for something as simple as `cube` felt like overkill.

---

## Iteration 5 — Plain TS types + separate Zod schemas (`src_/chat/nodes.ts`)

Briefly tried defining plain TypeScript types first and annotating Zod schemas with `z.ZodType<MyType>`, keeping the two layers explicit. Clean, but redundant — you end up writing each shape twice.

---

## What settled (`src/`) — Simple flat discriminated union

Dropped the `data` envelope, the registry, the codec machinery, and the children-based tree. Just flat Zod schemas with a discriminated union:

```ts
const CoreSolidNode = z.discriminatedUnion('type', [CoreCuboidNode, CoreSphereNode]);
const CoreBooleanNode = z.discriminatedUnion('type', [z.object({ type: z.literal('union'), target: CoreSolidNode, tools: z.array(CoreSolidNode) })]);
export const AnyCoreNode = z.intersection(z.discriminatedUnion('type', [CoreSolidNode, CoreBooleanNode]), z.object({ stack: z.optional(z.string()) }));
```

Helper functions (`cuboid()`, `cube()`, `union()`) capture the call stack for error reporting. `defineModel` / `resolveModel` / `renderModel` form a three-phase pipeline. The brepjs renderer is a simple `switch` over `AnyCoreNode` node types.

### Open issues to tackle next
- Boolean nodes only accept `CoreSolidNode` children — nested booleans (`union(union(a,b), c)`) aren't representable yet. Needs recursive `AnyCoreNode` children.
- No transform nodes yet (translate, rotate, scale).
- A potential "normalize/optimize" pass between resolve and render (deduplication, bounding box hints, LOD).
