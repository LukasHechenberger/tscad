import { defineModel } from '@tscad/modeling';
import { z } from 'zod';
import { gridfinityBaseplate } from '.';

export default defineModel({
  parameters: z.object({
    width: z.number().int().min(1).max(15).default(2).describe('Width in grid units'),
    height: z.number().int().min(1).max(15).default(1).describe('Height in grid units'),
    outerPadding: z.boolean().default(true),
  }),
  body: ({ width, height, ...parameters }) =>
    gridfinityBaseplate({ grid: { x: width, y: height }, ...parameters }),
});
