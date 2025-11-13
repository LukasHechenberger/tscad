import { defineModel } from '@tscad/modeling';
import { gridfinityBaseplate } from '.';

export default defineModel({
  parameters: {
    width: {
      type: 'number',
      minimum: 1,
      default: 2,
      maximum: 15,
      description: 'Width in grid units',
    },
    height: {
      type: 'number',
      minimum: 1,
      default: 1,
      maximum: 15,
      description: 'Height in grid units',
    },
    outerPadding: { type: 'boolean', default: true },
  },
  model: ({ width, height, ...parameters }) => {
    return gridfinityBaseplate({ grid: [width, height], ...parameters });
  },
});
