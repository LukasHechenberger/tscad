export function Anchor({ id: anchorId }: { id: string }) {
  return <div className="pointer-events-none -mt-24 pt-24" id={anchorId}></div>;
}
