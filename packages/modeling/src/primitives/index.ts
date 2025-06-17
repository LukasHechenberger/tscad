import modeling from '@jscad/modeling';

const { primitives } = modeling;

export function cube(options: primitives.CubeOptions) {
  return primitives.cube(options);
}

export function sphere(options: primitives.SphereOptions) {
  return primitives.sphere(options);
}
