import { expect, test } from 'bun:test';
import {
  circle,
  color,
  cube,
  cylinder,
  difference,
  linear_extrude,
  mirror,
  offset,
  plugin,
  pluginOperation,
  polygon,
  rotate,
  rotate_extrude,
  scale,
  Shape,
  Shape2D,
  sphere,
  square,
  translate,
  union,
} from './index';

test('omitted vector components default to 0', () => {
  expect(translate({ z: 5 }, cube(1)).node).toMatchObject({
    type: 'translate',
    v: { x: 0, y: 0, z: 5 },
  });
});

test('cylinder resolves r/d/r1/r2 like OpenSCAD', () => {
  expect(cylinder({ h: 2, d: 6 }).node).toEqual({
    type: 'cylinder',
    h: 2,
    r1: 3,
    r2: 3,
    center: false,
  });
  expect(cylinder({ h: 2, r: 3, r2: 0 }).node).toMatchObject({ r1: 3, r2: 0 });
  expect(sphere({ d: 4 }).node).toEqual({ type: 'sphere', r: 2 });
});

test('chained and functional forms build the same tree', () => {
  expect(cube(10).translate({ x: 5 }).node).toEqual(translate({ x: 5 }, cube(10)).node);
});

test('serializes to the kernel wire format', () => {
  // eslint-disable-next-line unicorn/prefer-structured-clone -- tests the JSON wire format
  const json = JSON.parse(JSON.stringify(difference(cube({ x: 1, y: 2, z: 3 }), sphere({ r: 1 }))));
  expect(json).toEqual({
    type: 'difference',
    children: [
      { type: 'cube', size: { x: 1, y: 2, z: 3 }, center: false },
      { type: 'sphere', r: 1 },
    ],
  });
});

test('rejects invalid sizes', () => {
  expect(() => cube(-1)).toThrow('x must be a non-negative number');
});

test('2D profiles extrude into solids', () => {
  const tri = polygon({
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
  });
  expect(linear_extrude({ height: 2 }, tri, square(1)).node).toMatchObject({
    type: 'linear_extrude',
    height: 2,
    center: false,
    children: [{ type: 'polygon' }, { type: 'square', size: { x: 1, y: 1 }, center: false }],
  });
  expect(() => polygon({ points: [{ x: 0, y: 0 }] })).toThrow('at least 3 points');
});

test('2D shapes are not solids', () => {
  // @ts-expect-error a Shape2D cannot be combined with solids until it is extruded
  union(square(1));
  // @ts-expect-error and a solid is not a 2D profile
  linear_extrude({ height: 1 }, cube(1));
});

test('transforms keep 2D shapes 2D', () => {
  const moved = translate({ x: 1 }, square(1));
  expect(moved).toBeInstanceOf(Shape2D);
  expect(square(1).mirror({ y: 1 }).scale(2)).toBeInstanceOf(Shape2D);
  expect(rotate({ z: 45 }, cube(1))).toBeInstanceOf(Shape);
  // @ts-expect-error still not a solid
  union(moved);
});

test('mirror and scale', () => {
  expect(cube(1).mirror({ x: 1 }).node).toMatchObject({ type: 'mirror', v: { x: 1, y: 0, z: 0 } });
  expect(scale(2, cube(1)).node).toMatchObject({ type: 'scale', v: { x: 2, y: 2, z: 2 } });
  expect(() => mirror({}, cube(1))).toThrow('normal must not be zero');
  expect(() => scale(0, cube(1))).toThrow('greater than 0');
});

test('extrusions send only non-default options', () => {
  expect(linear_extrude({ height: 2 }, square(1)).node).toEqual({
    type: 'linear_extrude',
    height: 2,
    center: false,
    children: [expect.anything()],
  });
  expect(linear_extrude({ height: 2, twist: 90, scale: 0.5 }, square(1)).node).toMatchObject({
    twist: 90,
    scale: 0.5,
  });
  expect(rotate_extrude({}, square(1)).node).toEqual({
    type: 'rotate_extrude',
    children: [expect.anything()],
  });
  expect(rotate_extrude({ angle: 90 }, square(1)).node).toMatchObject({ angle: 90 });
  expect(() => rotate_extrude({ angle: 400 }, square(1))).toThrow('within [-360, 360]');
  expect(() => linear_extrude({ height: 1, scale: 0 }, square(1))).toThrow('greater than 0');
});

test('segments turn circles into regular polygons', () => {
  const hex = circle({ r: 2, segments: 6 }).node;
  expect(hex.type).toBe('polygon');
  expect(hex.type === 'polygon' && hex.points[0]).toEqual({ x: 2, y: 0 });
  expect(hex.type === 'polygon' ? hex.points.length : 0).toBe(6);
  expect(cylinder({ h: 3, r: 2, segments: 6 }).node).toMatchObject({
    type: 'linear_extrude',
    height: 3,
    children: [{ type: 'polygon' }],
  });
  expect(cylinder({ h: 3, r1: 2, r2: 1, segments: 4 }).node).toMatchObject({
    type: 'linear_extrude',
    scale: 0.5,
  });
  expect(() => circle({ r: 1, segments: 2 })).toThrow('at least 3');
  expect(() => cylinder({ h: 1, r1: 1, r2: 0, segments: 4 })).toThrow('pointed end');
});

test('polygon paths cut holes', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 4 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
  ];
  expect(
    polygon({
      points,
      paths: [
        [0, 1, 2],
        [3, 4, 5],
      ],
    }).node,
  ).toMatchObject({
    paths: [
      [0, 1, 2],
      [3, 4, 5],
    ],
  });
  expect(() => polygon({ points, paths: [[0, 1, 9]] })).toThrow('index 9 is out of range');
});

test('rotate takes degrees; color wraps its children', () => {
  expect(cube(1).rotate({ x: 90 }).color('red').node).toEqual(
    color('red', rotate({ x: 90 }, cube(1))).node,
  );
  expect(rotate({ z: 45 }, cube(1)).node).toMatchObject({ a: { x: 0, y: 0, z: 45 } });
});

test('offset takes r (round) or delta (sharp) and stays 2D', () => {
  expect(offset({ r: 2 }, square(10)).node).toMatchObject({
    type: 'offset',
    r: 2,
    children: [{ type: 'square' }],
  });
  expect(offset({ delta: -1 }, circle({ r: 3 })).node).toEqual({
    type: 'offset',
    delta: -1,
    children: [{ type: 'circle', r: 3 }],
  });
  expect(() => offset({ r: Number.NaN }, square(1))).toThrow('offset: r must be a number');
  // @ts-expect-error offset results are 2D: extrude them first
  union(offset({ r: 1 }, square(1)));
});

test('pluginOperation builds the same node as plugin', () => {
  const grid = pluginOperation<{ nx: number; dx: number }>('grid');
  expect(grid({ nx: 3, dx: 10 }, cube(1)).node).toEqual(
    plugin('grid', { nx: 3, dx: 10 }, cube(1)).node,
  );
  // @ts-expect-error options are typed
  grid({ nx: '3', dx: 10 });
});
