// This orders the animation only. The backend owns the affected supplier sets.
// Never add a graph-reachable supplier that is absent from AnalysisResult.
export function getRevealGroups(result, suppliers) {
  const direct = new Set(result.directly_affected);
  const remaining = new Set(result.cascading_affected.filter((id) => !direct.has(id)));
  const byId = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const visited = new Set(direct);
  const groups = direct.size ? [[...direct]] : [];
  let frontier = [...direct];

  while (frontier.length) {
    const next = [];
    for (const id of frontier) {
      for (const child of byId.get(id)?.downstream_dependents ?? []) {
        if (!remaining.has(child) || visited.has(child)) continue;
        visited.add(child);
        remaining.delete(child);
        next.push(child);
      }
    }
    if (next.length) groups.push(next);
    frontier = next;
  }

  // Preserve API evidence even if this supplier snapshot lacks an edge.
  if (remaining.size) groups.push([...remaining]);
  return groups;
}
