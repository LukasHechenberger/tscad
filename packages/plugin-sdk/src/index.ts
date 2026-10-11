/**
 * Tools for writing tscad plugins: the WIT they implement (`wit/tscad-plugin.wit` in this package)
 * and `tscad-plugin build`, which turns a plugin's Rust crate into a loadable package.
 */
export { buildPlugin, WIT_DIRECTORY, type BuildResult } from './build';
export { optionsWit } from './options-wit';
export { typedExports } from './typed-exports';
