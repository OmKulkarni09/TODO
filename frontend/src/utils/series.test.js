import { describe, it, expect } from 'vitest'
import { groupBySeries, getSeriesRootId } from './series.js'

function task(id, parent_task_id = null, completedAt = null, extras = {}) {
  return {
    id,
    parent_task_id,
    title: `t${id}`,
    completed_at: completedAt,
    status: completedAt ? 'completed' : 'pending',
    ...extras,
  }
}

describe('getSeriesRootId', () => {
  it('returns the task id when it has no parent', () => {
    const t1 = task(1)
    const byId = new Map([[1, t1]])
    expect(getSeriesRootId(t1, byId)).toBe(1)
  })

  it('walks a chain back to the root', () => {
    const t1 = task(1)
    const t2 = task(2, 1)
    const t3 = task(3, 2)
    const t4 = task(4, 3)
    const byId = new Map([
      [1, t1], [2, t2], [3, t3], [4, t4],
    ])
    expect(getSeriesRootId(t4, byId)).toBe(1)
    expect(getSeriesRootId(t3, byId)).toBe(1)
    expect(getSeriesRootId(t2, byId)).toBe(1)
    expect(getSeriesRootId(t1, byId)).toBe(1)
  })

  it('returns current id when ancestor is missing from map', () => {
    // Simulates filtered views where the parent might not be in the array
    const t3 = task(3, 99) // parent 99 not in map
    const byId = new Map([[3, t3]])
    expect(getSeriesRootId(t3, byId)).toBe(3)
  })

  it('respects safety limit on cyclic chains', () => {
    // If somehow we got a cycle (shouldn't happen but defensive)
    const t1 = task(1, 2)
    const t2 = task(2, 1)
    const byId = new Map([[1, t1], [2, t2]])
    // Should not infinite-loop; will hit safety limit and return something
    const result = getSeriesRootId(t1, byId, 10)
    expect(typeof result).toBe('number')
  })
})

describe('groupBySeries', () => {
  it('returns empty array for empty input', () => {
    expect(groupBySeries([])).toEqual([])
  })

  it('returns singletons unchanged (no _seriesCount field)', () => {
    const t = task(1, null, '2026-05-15T10:00:00Z')
    const result = groupBySeries([t])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(t)
    expect(result[0]._seriesCount).toBeUndefined()
  })

  it('groups a multi-member series into one representative', () => {
    const t1 = task(1, null, '2026-05-01T10:00:00Z')
    const t2 = task(2, 1, '2026-05-08T10:00:00Z')
    const t3 = task(3, 2, '2026-05-15T10:00:00Z')
    const result = groupBySeries([t1, t2, t3])
    expect(result).toHaveLength(1)
    expect(result[0]._seriesCount).toBe(3)
    expect(result[0]._seriesMembers).toHaveLength(3)
    // The representative is the LATEST (most recent completed_at)
    expect(result[0].id).toBe(3)
  })

  it('returns multiple groups for independent series', () => {
    const a1 = task(1, null, '2026-05-01T10:00:00Z')
    const a2 = task(2, 1, '2026-05-08T10:00:00Z')
    const b1 = task(10, null, '2026-05-03T10:00:00Z')
    const b2 = task(11, 10, '2026-05-10T10:00:00Z')
    const result = groupBySeries([a1, a2, b1, b2])
    expect(result).toHaveLength(2)
    const counts = result.map((r) => r._seriesCount).sort()
    expect(counts).toEqual([2, 2])
  })

  it('sorts groups by latest completion descending', () => {
    const old1 = task(1, null, '2026-01-01T10:00:00Z')
    const newer1 = task(10, null, '2026-05-01T10:00:00Z')
    const result = groupBySeries([old1, newer1])
    expect(result[0].id).toBe(10) // newer first
    expect(result[1].id).toBe(1)
  })

  it('uses allTasks to resolve parents not in the filtered list', () => {
    // Scenario: viewing only completed tasks, but the root of a series
    // is also completed and present. Should still group correctly.
    const root = task(1, null, '2026-05-01T10:00:00Z')
    const middle = task(2, 1, '2026-05-08T10:00:00Z')
    const leaf = task(3, 2, '2026-05-15T10:00:00Z')
    const result = groupBySeries([leaf], [root, middle, leaf])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(3)
    // Only one member is "in the filtered set" but parent walk still works
    expect(result[0]._seriesCount).toBeUndefined() // single member in filter
  })

  it('does not mutate input tasks', () => {
    const t1 = task(1, null, '2026-05-01T10:00:00Z')
    const t2 = task(2, 1, '2026-05-08T10:00:00Z')
    const beforeSnapshot = JSON.stringify([t1, t2])
    groupBySeries([t1, t2])
    expect(JSON.stringify([t1, t2])).toBe(beforeSnapshot)
  })

  it('handles tasks with null completed_at', () => {
    // Pending tasks shouldn't be passed in normally, but if they are,
    // the sort should not crash
    const t1 = task(1, null, null)
    const t2 = task(2, 1, null)
    const result = groupBySeries([t1, t2])
    expect(result).toHaveLength(1)
    expect(result[0]._seriesCount).toBe(2)
  })

  describe('orphan-recurring fallback (legacy data without parent_task_id)', () => {
    it('collapses multiple orphan recurring tasks with same title+recurrence', () => {
      // All 4 are orphans (parent=null, no descendants), same title+recurrence
      const orphans = [
        task(17, null, '2026-05-15T09:29:14Z', { recurrence: 'daily', title: 'Recur' }),
        task(18, null, '2026-05-15T09:29:21Z', { recurrence: 'daily', title: 'Recur' }),
        task(19, null, '2026-05-15T09:29:26Z', { recurrence: 'daily', title: 'Recur' }),
        task(20, null, '2026-05-15T09:29:30Z', { recurrence: 'daily', title: 'Recur' }),
      ]
      const result = groupBySeries(orphans)
      expect(result).toHaveLength(1)
      expect(result[0]._seriesCount).toBe(4)
    })

    it('does NOT collapse if titles differ', () => {
      const a = task(1, null, '2026-05-15T10:00:00Z', { recurrence: 'daily', title: 'A' })
      const b = task(2, null, '2026-05-15T10:00:00Z', { recurrence: 'daily', title: 'B' })
      expect(groupBySeries([a, b])).toHaveLength(2)
    })

    it('does NOT collapse if recurrence rules differ', () => {
      const a = task(1, null, '2026-05-15T10:00:00Z', { recurrence: 'daily', title: 'X' })
      const b = task(2, null, '2026-05-15T10:00:00Z', { recurrence: 'weekly', title: 'X' })
      expect(groupBySeries([a, b])).toHaveLength(2)
    })

    it('does NOT collapse non-recurring orphans', () => {
      // No recurrence rule — these are intentionally separate tasks
      const a = task(1, null, '2026-05-15T10:00:00Z', { recurrence: null, title: 'X' })
      const b = task(2, null, '2026-05-15T10:00:00Z', { recurrence: null, title: 'X' })
      expect(groupBySeries([a, b])).toHaveLength(2)
    })

    it('does NOT merge an orphan into a properly-linked series of same title', () => {
      // Linked series: root → child
      const root = task(1, null, '2026-05-01T10:00:00Z', { recurrence: 'daily', title: 'X' })
      const child = task(2, 1, '2026-05-02T10:00:00Z', { recurrence: 'daily', title: 'X' })
      // Independent orphan with same title (no descendants)
      const orphan = task(99, null, '2026-05-10T10:00:00Z', { recurrence: 'daily', title: 'X' })

      const result = groupBySeries([root, child, orphan])
      // Two groups: the {root, child} linked series + the orphan singleton
      expect(result).toHaveLength(2)
      const seriesGroup = result.find((r) => r._seriesCount === 2)
      const standaloneGroup = result.find((r) => r._seriesCount === undefined)
      expect(seriesGroup._seriesMembers.map((m) => m.id).sort()).toEqual([1, 2])
      expect(standaloneGroup.id).toBe(99)
    })

    it('orphan with descendant in the data stays id-keyed (it has a child)', () => {
      // root has a child — so it's NOT a true orphan, even though parent=null
      const root = task(1, null, '2026-05-01T10:00:00Z', { recurrence: 'daily', title: 'X' })
      const child = task(2, 1, '2026-05-02T10:00:00Z', { recurrence: 'daily', title: 'X' })
      const orphan = task(99, null, '2026-05-10T10:00:00Z', { recurrence: 'daily', title: 'X' })

      const result = groupBySeries([root], [root, child, orphan])
      // We pass only [root] to be grouped; allTasks shows root has child → root
      // is NOT an orphan; orphan is unrelated; root stays id-keyed singleton.
      expect(result).toHaveLength(1)
    })
  })
})
