import { defineModel } from '@tscad/modeling';
import { gridfinityBaseplate } from '.';

export default defineModel({
  parameters: {
    // Note: Adjust during development to test different sizes
    width: { type: 'number', default: 2 },
    length: { type: 'number', default: 1 },
    length2: { type: 'string', default: '1' },
  },
  body({ width, length, length2 }) {
    return gridfinityBaseplate({ grid: [width, length] });
  },
});
