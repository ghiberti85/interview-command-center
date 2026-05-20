export function filterProcesses(list, search, stageFilter) {
  const q = search.toLowerCase();
  return list.filter(p =>
    (stageFilter === "all" || p.stage === stageFilter) &&
    (!q ||
      p.company.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    )
  );
}
