import { ToolDecorator as Tool, ExecutionContext } from '@nitrostack/core';
import { ProjectGrowthInput } from '../../shared/contracts.js';

export class GrowthTools {
  @Tool({
    name: 'project_investment_growth',
    description: 'Project projected investment growth for monthly SIP-like investments',
    inputSchema: ProjectGrowthInput
  })
  async projectInvestmentGrowth(input: any, ctx: ExecutionContext) {
    ctx.logger.info('project_investment_growth called', { input });

    const lowEstimate =  Math.round(input.monthlyAmount * input.years * 12 * 1.03);
    const highEstimate = Math.round(input.monthlyAmount * input.years * 12 * 1.12);

    return {
      lowEstimate,
      highEstimate,
      assumptions: ['Returns are illustrative and not guaranteed', 'Estimates assume regular monthly investment'],
      navSource: 'mock-mfapi',
      risk_note: 'This is an illustrative projection for educational purposes only.',
      educational_only: true
    };
  }
}
