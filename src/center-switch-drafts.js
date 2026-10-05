// A baseline belongs to one opened draft, not to a module or a center. Forms
// can rerender many times while the owner edits them, so the baseline survives
// replacement of a form-state object until that form closes or changes target.
export function createCenterSwitchDraftTracker() {
  const baselines = new Map()
  const serialize = (value) => JSON.stringify(value ?? null)

  function observe(drafts = []) {
    const active = new Set()
    for (const draft of drafts) {
      if (!draft?.key) continue
      active.add(draft.key)
      const previous = baselines.get(draft.key)
      if (!previous || previous.identity !== draft.identity) {
        baselines.set(draft.key, {
          identity: draft.identity,
          value: serialize(draft.value),
        })
      }
    }
    for (const key of baselines.keys()) {
      if (!active.has(key)) baselines.delete(key)
    }
  }

  function dirty(drafts = []) {
    return drafts.filter((draft) => {
      const baseline = baselines.get(draft.key)
      return baseline && baseline.identity === draft.identity
        && baseline.value !== serialize(draft.value)
    })
  }

  return { observe, dirty, reset: () => baselines.clear() }
}
