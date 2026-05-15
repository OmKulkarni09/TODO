/**
 * Recurring task series utilities.
 *
 * A "series" is the chain of tasks linked via parent_task_id:
 *   root (parent_task_id=null) → child → grandchild → …
 * When a recurring task is completed, the backend spawns a new task with
 * parent_task_id pointing to the just-completed one. So each series has
 * exactly one root and zero-or-more descendants.
 */

/** Walk parent_task_id back to the series root id. */
export function getSeriesRootId(task, byId, safetyLimit = 200) {
  let current = task
  for (let i = 0; i < safetyLimit; i++) {
    if (current.parent_task_id == null) return current.id
    const parent = byId.get(current.parent_task_id)
    if (!parent) return current.id // ancestor missing → treat current as root
    current = parent
  }
  return current.id
}

/**
 * Group a list of (typically completed) tasks by their series root and return
 * one "representative" item per group — the most recently completed task in
 * the series, augmented with `_seriesCount` and `_seriesMembers`.
 *
 * Singletons (count == 1) are returned as the original task object unchanged,
 * so non-recurring tasks render exactly as before.
 *
 * `allTasks` is the full task list (needed so we can resolve parent ids that
 * may not be in `tasks` if the caller filtered).
 *
 * Orphan-recurring fallback: tasks created before parent_task_id existed
 * have null parent_task_id but a real recurrence rule. They appear as
 * independent "series of one". To collapse such legacy orphans we group
 * them by (title, recurrence) — but ONLY when the root is truly orphan
 * (no descendants reference it). This avoids false-merging a properly
 * linked series with an unrelated same-named task.
 */
export function groupBySeries(tasks, allTasks = tasks) {
  if (!tasks.length) return []
  const byId = new Map(allTasks.map((t) => [t.id, t]))

  // Roots that appear as the parent of some other task — they have descendants
  // and are part of a properly-linked series, so we DON'T touch them.
  const rootsWithDescendants = new Set()
  for (const t of allTasks) {
    if (t.parent_task_id != null) rootsWithDescendants.add(t.parent_task_id)
  }

  // For each visible task, find its root and produce a canonical group key.
  const canonicalKey = (task) => {
    const rootId = getSeriesRootId(task, byId)
    const root = byId.get(rootId)
    if (
      root &&
      root.parent_task_id == null &&
      root.recurrence &&
      !rootsWithDescendants.has(rootId)
    ) {
      // Legacy orphan recurring task — collapse by (title, recurrence)
      return `series:${root.title}|${root.recurrence}`
    }
    return `id:${rootId}`
  }

  const groups = new Map()
  for (const t of tasks) {
    const key = canonicalKey(t)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(t)
  }

  const sortDesc = (a, b) => {
    const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0
    const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0
    return tb - ta
  }

  const result = []
  for (const members of groups.values()) {
    members.sort(sortDesc)
    const latest = members[0]
    if (members.length === 1) {
      result.push(latest)
    } else {
      result.push({
        ...latest,
        _seriesCount: members.length,
        _seriesMembers: members,
      })
    }
  }
  result.sort(sortDesc)
  return result
}
