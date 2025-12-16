import { Command } from '@tscad/commander';

/** A Command subclass that includes a model option */
export class ModelCommand extends Command {
  constructor(name?: string) {
    super(name);

    this.option('--model [model]', 'Where to find the tscad model', 'src/model.ts');
  }
}
