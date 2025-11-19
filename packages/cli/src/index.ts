import { existsSync } from 'node:fs';
import path from 'node:path';
import { inspect, styleText } from 'node:util';
import { InvalidOptionArgumentError, Option, program } from '@tscad/commander';
import type { AnyModel } from '@tscad/modeling';
import { ajv } from '@tscad/modeling/runtime';
import { kebabCase } from 'change-case';
import { build, type BuildFailure, formatMessagesSync } from 'esbuild';
import { devCommand as developmentCommand } from '@/commands/dev';
import { description, version } from '../package.json';
import { exportCommand } from './commands/export';
import { rootDebug } from './lib/log';

const debug = rootDebug.extend('cli');

// Add general usage info
export const cli = program
  .name('tscad')
  .version(version)
  .description(description)

  // NOTE: Uncomment if we have commands without model
  // .command('model', { isDefault: true })

  .option('--model [model]', 'Where to find the tscad model', './src/model.ts')

  .hook('preSubcommand', async (thisCommand, actionCommand) => {
    const { model } = thisCommand.opts();
    const { ...optionsSoFar } = actionCommand.opts();

    if (actionCommand.name() !== 'export') {
      debug('Skipping model processing for command', actionCommand.name());
      return;
    }

    debug('processing model option...');

    if (model) {
      try {
        const modelSource = thisCommand.getOptionValueSource('model');
        const isDefaultModel = modelSource === 'default';

        debug('Loading model parameters...');
        const sourcePath = path.join(process.cwd(), model);

        if (!existsSync(sourcePath)) {
          if (isDefaultModel) {
            // Usage error
            actionCommand.showHelpAfterError();

            throw new Error('No model found at default path. Please specify a model file.');
          }

          throw new Error(
            `Model file not found at path '${model}' 
(resolved to '${sourcePath}')`,
          );
        }

        const outPath = path.join(process.cwd(), optionsSoFar.output ?? 'out/model.stl');
        const outPathExtname = path.extname(outPath);

        let importPath = sourcePath;

        if (model.endsWith('.ts')) {
          importPath = outPath.replace(outPathExtname, '.mjs');

          try {
            // eslint-disable-next-line no-console
            console.info(`👷 Building model at ${path.relative(process.cwd(), sourcePath)}...`);
            await build({
              entryPoints: [sourcePath],
              bundle: true,
              format: 'esm',
              outfile: importPath,
              logLevel: 'silent',
            });
            debug('Model built to', path.relative(process.cwd(), importPath));
          } catch (error) {
            throw new Error(
              `Building model at ${path.relative(process.cwd(), sourcePath)} failed:

${formatMessagesSync((error as BuildFailure).errors, {
  kind: 'error',
  color: true,
}).join('\n')}`,
            );
          }
        }

        debug('Loading model');
        // eslint-disable-next-line no-console
        console.info(`🛬 Loading model from ${path.relative(process.cwd(), importPath)}...`);
        const loadedModel = await import(importPath).then(
          (module_) => module_.default ?? module_.main ?? module_,
        );

        debug('Model loaded');

        actionCommand.setOptionValue('model', importPath);
        actionCommand.setOptionValue('processedModel', loadedModel);

        if (!loadedModel) {
          throw new Error(`Failed to load model from ${importPath}: It is ${inspect(loadedModel)}`);
        }

        if (loadedModel.parametersSchema) {
          actionCommand.optionsGroup('Model parameters:');
          try {
            for (const [name, schema] of Object.entries(
              (loadedModel as AnyModel).parametersSchema,
            )) {
              debug('Adding parameter option:', name, schema);
              const flagName = kebabCase(name);

              const validate = ajv.compile(schema);
              actionCommand.option(
                `--${flagName} ${schema.type === 'boolean' ? '' : `[${name}]`}`.trim(),
                schema.description ?? `Set the \`${name}\` parameter`,
                (value) => {
                  const valid = validate(value);

                  if (!valid) {
                    throw new InvalidOptionArgumentError(
                      ajv.errorsText(validate.errors, { dataVar: `${flagName}` }),
                    );
                  }

                  return value;
                },

                schema.default,
              );

              if (schema.type === 'boolean') {
                actionCommand.addOption(
                  new Option(`--no-${flagName}`, `Disable ${name}`).hideHelp(),
                );
              }
            }
          } catch (error) {
            actionCommand.allowUnknownOption();
            actionCommand.allowExcessArguments();
            throw new Error(`Failed to infer model parameters: ${(error as Error).message}`);
          } finally {
            actionCommand.optionsGroup('Options:');
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn(`ℹ️  ${styleText(['yellow'], 'Model has no parameters schema.')}`);
        }
      } catch (error) {
        debug(error);
        actionCommand.setOptionValue('modelProcessingError', error);
      }
    }
  })

  // Add commands
  .addCommand(developmentCommand)
  .addCommand(exportCommand);
