import type { AnalysisContext, AnalysisTool, AnalysisToolDescriptor } from './contracts';

export class ToolRegistry {
  private readonly tools = new Map<string, AnalysisTool>();

  register(tool: AnalysisTool): this {
    if (this.tools.has(tool.descriptor.id)) {
      throw new Error(`Analysis tool '${tool.descriptor.id}' is already registered.`);
    }
    this.tools.set(tool.descriptor.id, tool);
    return this;
  }

  list(context?: AnalysisContext): AnalysisToolDescriptor[] {
    return [...this.tools.values()]
      .filter((tool) => !context || tool.canRun(context))
      .map((tool) => tool.descriptor);
  }

  get(id: string): AnalysisTool | undefined {
    return this.tools.get(id);
  }

  async run<TResult = unknown>(id: string, context: AnalysisContext): Promise<TResult> {
    const tool = this.tools.get(id);
    if (!tool) throw new Error(`Unknown analysis tool '${id}'.`);
    if (!tool.canRun(context)) throw new Error(`Analysis tool '${id}' cannot run in context '${context.kind}'.`);
    return tool.run(context) as Promise<TResult>;
  }
}
