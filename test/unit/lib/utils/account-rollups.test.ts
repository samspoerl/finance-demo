import {
  buildAccountRollups,
  type RollupAccountInput,
} from '@/lib/utils/account-rollups'
import { describe, expect, it } from 'vitest'

function account(
  overrides: Partial<RollupAccountInput> & { id: number }
): RollupAccountInput {
  return {
    name: `Account ${overrides.id}`,
    mask: null,
    type: 'cash',
    subtype: 'checking',
    institutionName: null,
    currentBalance: 0,
    ...overrides,
  }
}

describe('buildAccountRollups', () => {
  it('splits accounts into assets and liabilities', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: 'cash', currentBalance: 100 }),
      account({ id: 2, type: 'credit card', currentBalance: 40 }),
    ])

    expect(categories.map((c) => c.category)).toEqual(['asset', 'liability'])
  })

  it('negates liability balances so they subtract from net worth', () => {
    const { assets, liabilities, netWorth } = buildAccountRollups([
      account({ id: 1, type: 'cash', currentBalance: 1000 }),
      account({ id: 2, type: 'credit card', currentBalance: 400 }),
    ])

    expect(assets).toBe(1000)
    expect(liabilities).toBe(-400)
    expect(netWorth).toBe(600)
  })

  it('totals each type group and each category', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: 'cash', currentBalance: 100 }),
      account({ id: 2, type: 'cash', currentBalance: 250 }),
      account({ id: 3, type: 'investment', currentBalance: 900 }),
    ])

    const [assetsGroup] = categories
    expect(assetsGroup.total).toBe(1250)
    expect(assetsGroup.types.map((t) => [t.type, t.total])).toEqual([
      ['cash', 350],
      ['investment', 900],
    ])
  })

  it('orders type groups by the account-types sort order, not alphabetically', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: 'real asset', currentBalance: 1 }),
      account({ id: 2, type: 'cash', currentBalance: 1 }),
      account({ id: 3, type: 'investment', currentBalance: 1 }),
    ])

    // Alphabetical would be cash, investment, real asset — which happens to
    // match here, so use the liability side where it does not.
    expect(categories[0].types.map((t) => t.type)).toEqual([
      'cash',
      'investment',
      'real asset',
    ])
  })

  it('sorts loan after credit card, where alphabetical would not', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: 'loan', currentBalance: 1 }),
      account({ id: 2, type: 'credit card', currentBalance: 1 }),
    ])

    expect(categories[0].types.map((t) => t.type)).toEqual([
      'credit card',
      'loan',
    ])
  })

  it('uses the display label from account-types', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: 'credit card', currentBalance: 1 }),
    ])

    expect(categories[0].types[0].label).toBe('Credit Card')
  })

  it('orders accounts within a type by raw balance, largest first', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: 'cash', currentBalance: 100 }),
      account({ id: 2, type: 'cash', currentBalance: 900 }),
      account({ id: 3, type: 'cash', currentBalance: 400 }),
    ])

    expect(categories[0].types[0].accounts.map((a) => a.id)).toEqual([2, 3, 1])
  })

  it('puts the largest debt at the top of a liability group', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: 'credit card', currentBalance: 200 }),
      account({ id: 2, type: 'credit card', currentBalance: 800 }),
    ])

    expect(categories[0].types[0].accounts.map((a) => a.id)).toEqual([2, 1])
  })

  it('sorts an account with no snapshot to the end rather than among the zeroes', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: 'cash', currentBalance: null }),
      account({ id: 2, type: 'cash', currentBalance: 0 }),
    ])

    expect(categories[0].types[0].accounts.map((a) => a.id)).toEqual([2, 1])
  })

  it('counts a null balance as zero in the totals', () => {
    const { assets, netWorth } = buildAccountRollups([
      account({ id: 1, type: 'cash', currentBalance: null }),
      account({ id: 2, type: 'cash', currentBalance: 50 }),
    ])

    expect(assets).toBe(50)
    expect(netWorth).toBe(50)
  })

  /**
   * `normalizeBalance` only negates types it knows to be liabilities, so an
   * unrecognised type contributes positively to net worth. The rollup has to
   * agree, or a group's total would contradict the figure above it.
   */
  it('treats an unrecognised type as an asset, matching normalizeBalance', () => {
    const { categories, assets, netWorth } = buildAccountRollups([
      account({ id: 1, type: 'something-new', currentBalance: 300 }),
    ])

    expect(categories.map((c) => c.category)).toEqual(['asset'])
    expect(assets).toBe(300)
    expect(netWorth).toBe(300)
  })

  it('groups accounts with no type at all', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: null, currentBalance: 10 }),
    ])

    expect(categories[0].types[0].label).toBe('Unknown')
  })

  it('sorts unknown types after every known one', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: 'zzz-unknown', currentBalance: 1 }),
      account({ id: 2, type: 'cash', currentBalance: 1 }),
    ])

    expect(categories[0].types.map((t) => t.type)).toEqual([
      'cash',
      'zzz-unknown',
    ])
  })

  it('omits a category that has no accounts', () => {
    const { categories } = buildAccountRollups([
      account({ id: 1, type: 'cash', currentBalance: 100 }),
    ])

    expect(categories).toHaveLength(1)
    expect(categories[0].category).toBe('asset')
  })

  it('returns nothing for an empty account list', () => {
    expect(buildAccountRollups([])).toEqual({
      categories: [],
      assets: 0,
      liabilities: 0,
      netWorth: 0,
    })
  })
})
