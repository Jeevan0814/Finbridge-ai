import { ToolDecorator as Tool, ExecutionContext } from '@nitrostack/core';
import { ExplainConceptInput, ExplainConceptOutput } from '../../shared/contracts.js';

export class ExplainTools {
  @Tool({
    name: 'explain_financial_concept',
    description: 'Provide a beginner-friendly explanation of a financial term',
    inputSchema: ExplainConceptInput
  })
  async explainFinancialConcept(input: any, ctx: ExecutionContext) {
    ctx.logger.info('explain_financial_concept called', { input });

    const term = input.term;

    const output = {
      term,
      explanation: `${term} is a commonly used term in personal finance. This is a short educational explanation.`,
      example: `Example usage of ${term} in everyday finance: ...`,
      risk_note: 'Educational-only explanation; consult a qualified advisor for personal advice.',
      educational_only: true
    };

    return output;
  }
}
