import Ajv from 'ajv';

export const ajv = new Ajv({
  useDefaults: true,
  strict: false,
  removeAdditional: true,
  coerceTypes: true,
});
