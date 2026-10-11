/**
 * Evaluates a model for `tscad dev` and prints an `EvalResult` as JSON on stdout. Runs in a fresh
 * process per change, because Bun cannot evict already-imported modules (edits to a model's
 * imports would otherwise be missed).
 *
 * Usage: `bun eval-model.js model.ts [values-as-json]`
 */

import { describeError, type EvalResult, evaluateModel } from '@tscad/modeling';
import { importModel } from './lib/model';

const [modelPath, valuesJson = '{}'] = Bun.argv.slice(2);
const result: EvalResult = await importModel(modelPath!).then(
  (exported) => evaluateModel(exported, JSON.parse(valuesJson)),
  (error: unknown) => ({ error: describeError(error) }),
);
process.stdout.write(JSON.stringify(result));
