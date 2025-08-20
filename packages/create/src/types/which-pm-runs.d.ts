declare module 'which-pm-runs' {
  export default function whichPmRuns(): { name: string; version: string } | undefined;
}
