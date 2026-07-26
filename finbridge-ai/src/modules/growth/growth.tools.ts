import { ToolDecorator as Tool, ExecutionContext } from '@nitrostack/core';
import { ProjectGrowthInput } from '../../shared/contracts.js';

/**
 * Annual return rate ranges by fund category (p.a., illustrative).
 * Based on historical long-term averages — not guaranteed.
 */
const RATE_RANGES: Record<string, { low: number; high: number; label: string }> = {
  equity:  { low: 0.10, high: 0.14, label: '10%–14% p.a. (Equity)' },
  debt:    { low: 0.06, high: 0.08, label: '6%–8% p.a. (Debt)' },
  hybrid:  { low: 0.08, high: 0.11, label: '8%–11% p.a. (Hybrid)' },
  index:   { low: 0.10, high: 0.12, label: '10%–12% p.a. (Index)' }
};

/**
 * SIP Future Value Formula:
 *   FV = P × [((1 + r)^n - 1) / r] × (1 + r)
 *   where:
 *     P = monthly investment amount
 *     r = monthly interest rate (annual rate / 12)
 *     n = total number of months (years × 12)
 */
function sipFutureValue(monthlyAmount: number, annualRate: number, years: number): number {
  const n = years * 12;
  const r = annualRate / 12;
  if (r === 0) return monthlyAmount * n;
  const fv = monthlyAmount * (((Math.pow(1 + r, n) - 1) / r) * (1 + r));
  return Math.round(fv);
}

export class GrowthTools {
  @Tool({
    name: 'project_investment_growth',
    description: 'Project SIP (Systematic Investment Plan) growth using the compound interest formula. Returns low and high estimates based on fund category historical return ranges.',
    inputSchema: ProjectGrowthInput
  })
  async projectInvestmentGrowth(input: any, ctx: ExecutionContext) {
    ctx.logger.info('project_investment_growth called', { input });

    const category = input.fundCategory as string;
    const rates = RATE_RANGES[category] ?? RATE_RANGES['hybrid'];

    const totalInvested = Math.round(input.monthlyAmount * input.years * 12);
    const lowEstimate  = sipFutureValue(input.monthlyAmount, rates.low,  input.years);
    const highEstimate = sipFutureValue(input.monthlyAmount, rates.high, input.years);
    const lowGain      = lowEstimate - totalInvested;
    const highGain     = highEstimate - totalInvested;

    return {
      lowEstimate,
      highEstimate,
      totalInvested,
      lowGain,
      highGain,
      assumptions: [
        `Fund category: ${category}`,
        `Assumed annual return range: ${rates.label}`,
        'SIP compounded monthly using standard future value formula',
        'Returns are illustrative long-term historical averages — not guaranteed',
        'Does not account for exit loads, expense ratios, or taxes'
      ],
      navSource: 'mfapi-illustrative',
      risk_note: 'Mutual fund investments are subject to market risks. Past performance does not guarantee future results. This projection is for educational purposes only.',
      educational_only: true as const
    };
  }
}
