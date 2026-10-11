import { existsSync } from 'node:fs';
import path from 'node:path';
import { styleText } from 'node:util';
import { InvalidOptionArgumentError, Option } from '@tscad/commander';
import { coerceParameter, Model } from '@tscad/modeling';
import { kebabCase } from 'change-case';
import { analyzeCommand } from '@/commands/analyze';
import { devCommand as developmentCommand } from '@/commands/dev';
import { pluginsCommand } from '@/commands/plugins';
import { description, version } from '../package.json';
import { exportCommand } from './commands/export';
import { ModelCommand } from './lib/commander';
import { rootDebug } from './lib/log';
import { importModel } from './lib/model';

const debug = rootDebug.extend('cli');

const program = new ModelCommand();

/** Commands that build the model, so they take its parameters as options. */
const modelCommands = new Set(['export', 'analyze']);

// Add general usage info
export const cli = program
  .name('tscad')
  .version(version)
  .description(description)

  .hook('preSubcommand', async (thisCommand, actionCommand) => {
    const { model } = thisCommand.opts();

    // Pass the model option to the action command
    actionCommand.setOptionValue('model', model);

    if (!modelCommands.has(actionCommand.name())) {
      debug('Skipping model processing for command', actionCommand.name());
      return;
    }

    debug('processing model option...');

    try {
      const isDefaultModel = thisCommand.getOptionValueSource('model') === 'default';
      const sourcePath = path.join(process.cwd(), model);

      if (!existsSync(sourcePath)) {
        if (isDefaultModel) {
          // Usage error
          actionCommand.showHelpAfterError();

          throw new Error('No model found at default path. Please specify a model file.');
        }

        throw new Error(`Model file not found at path '${model}'
(resolved to '${sourcePath}')`);
      }

      debug('Loading model');
      const loadedModel = await importModel(sourcePath);
      debug('Model loaded');

      actionCommand.setOptionValue('model', sourcePath);
      actionCommand.setOptionValue('processedModel', loadedModel);

      if (loadedModel instanceof Model) {
        // Every parameter becomes a `--kebab-case` option; its schema converts and checks values.
        const parameterOptions: Record<string, string> = {};
        actionCommand.optionsGroup('Model parameters:');
        try {
          for (const [name, schema] of Object.entries(
            loadedModel.parametersJsonSchema().properties ?? {},
          )) {
            debug('Adding parameter option:', name, schema);
            const flagName = kebabCase(name);
            const isBoolean = schema.type === 'boolean';
            const option = new Option(
              `--${flagName}${isBoolean ? '' : ` <${name}>`}`,
              schema.description ?? `Set the \`${name}\` parameter`,
            ).default(schema.default);
            if (!isBoolean) {
              option.argParser((value) => {
                const coerced = coerceParameter(value, schema);
                if (typeof coerced === 'string' && schema.type !== 'string' && !schema.enum)
                  throw new InvalidOptionArgumentError(`expected ${schema.type}, got "${value}"`);
                return coerced;
              });
            }
            actionCommand.addOption(option);
            parameterOptions[name] = option.attributeName();

            if (isBoolean) {
              actionCommand.addOption(new Option(`--no-${flagName}`, `Disable ${name}`).hideHelp());
            }
          }
        } finally {
          actionCommand.optionsGroup('Options:');
        }
        actionCommand.setOptionValue('parameterOptions', parameterOptions);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`ℹ️  ${styleText(['yellow'], 'Model has no parameters schema.')}`);
      }
    } catch (error) {
      debug(error);
      actionCommand.allowUnknownOption();
      actionCommand.allowExcessArguments();
      actionCommand.setOptionValue('modelProcessingError', error);
    }
  })

  // Add commands
  .addCommand(developmentCommand)
  .addCommand(exportCommand)
  .addCommand(analyzeCommand)
  .addCommand(pluginsCommand);
