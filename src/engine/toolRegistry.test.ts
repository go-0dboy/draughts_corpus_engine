import { describe, expect, it } from 'vitest';
import { MemoryCorpus } from './memoryCorpus';
import { ToolRegistry } from './toolRegistry';
import { positionStatisticsTool } from '../tools/positionStatistics';
import { INITIAL_POSITION } from '../core/position';

describe('ToolRegistry', () => {
  it('registers and runs tools through the stable corpus API', async () => {
    const corpus = new MemoryCorpus([]);
    const registry = new ToolRegistry().register(positionStatisticsTool);
    const context = { kind: 'position' as const, corpus, position: INITIAL_POSITION };

    expect(registry.list(context).map((tool) => tool.id)).toContain('position-statistics');
    const report = await registry.run<{ occurrences: unknown[] }>('position-statistics', context);
    expect(report.occurrences).toEqual([]);
  });
});
