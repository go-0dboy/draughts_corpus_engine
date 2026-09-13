import type { AnalysisContext, AnalysisTool } from '../engine/contracts';

export const positionStatisticsTool: AnalysisTool = {
  descriptor: {
    id: 'position-statistics',
    title: 'Статистика позиции',
    description: 'Вхождения позиции, результаты партий и популярные продолжения.',
    icon: 'position-statistics',
    supportedContexts: ['position'],
  },

  canRun(context: AnalysisContext): boolean {
    return context.kind === 'position' && Boolean(context.position);
  },

  async run(context: AnalysisContext) {
    if (!context.position) throw new Error('Position context is required.');
    return context.corpus.positionReport(context.position);
  },
};
