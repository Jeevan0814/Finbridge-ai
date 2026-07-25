import { ToolDecorator as Tool, ExecutionContext } from '@nitrostack/core';
import { FinancialHealthInput } from '../../shared/contracts.js';

export class FinancialHealthTools {
  @Tool({
    name: 'calculate_financial_health',
    description: 'Calculate a simple financial health score',
    inputSchema: FinancialHealthInput
  })
  async calculateFinancialHealth(input: any, ctx: ExecutionContext) {
    ctx.logger.info('calculate_financial_health called', { input });

    const savingsRate = input.savings / Math.max(1, input.monthlyIncome);
    const emergencyFund = (input.savings >= (input.emergencyFundMonths || 3) * input.monthlyExpenses) ? 1 : 0;
    const debtRatio = input.monthlyDebtPayment / Math.max(1, input.monthlyIncome);

    const score = Math.round(100 * (0.5 * Math.min(1, savingsRate) + 0.3 * emergencyFund + 0.2 * Math.max(0, 1 - debtRatio)));

    return {
      score,
      subScores: {
        savingsRate: Math.round(savingsRate * 100),
        emergencyFund: emergencyFund * 100,
        debtRatio: Math.round(Math.min(1, debtRatio) * 100)
      },
      suggestions: ['Increase savings rate', 'Build emergency fund to 3-6 months', 'Pay down high-interest debt'],
      risk_note: 'This score is illustrative and educational only.',
      educational_only: true
    };
  }
}
