import { ToolDecorator as Tool, ExecutionContext } from '@nitrostack/core';
import { FinancialHealthInput } from '../../shared/contracts.js';

/**
 * Score bands for financial health.
 */
function getScoreBand(score: number): string {
  if (score >= 81) return 'Excellent';
  if (score >= 61) return 'Good';
  if (score >= 41) return 'Fair';
  return 'Poor';
}

/**
 * Generate dynamic, data-driven suggestions based on actual sub-scores.
 */
function generateSuggestions(
  savingsRate: number,
  hasEmergencyFund: boolean,
  debtRatio: number,
  monthlyIncome: number,
  monthlyExpenses: number
): string[] {
  const suggestions: string[] = [];

  // Savings rate suggestions (savingsRate is a fraction 0–1)
  if (savingsRate < 0.10) {
    suggestions.push(
      `Your savings rate is very low (${Math.round(savingsRate * 100)}%). Start by saving at least 10% of your income — even ₹${Math.round(monthlyIncome * 0.1).toLocaleString()}/month makes a difference.`
    );
  } else if (savingsRate < 0.20) {
    suggestions.push(
      `Your savings rate is ${Math.round(savingsRate * 100)}%. Aim for 20% — try to increase by cutting discretionary expenses or automating savings via SIP.`
    );
  } else {
    suggestions.push(`Great savings rate of ${Math.round(savingsRate * 100)}%! Keep it up and consider investing the surplus in diversified mutual funds.`);
  }

  // Emergency fund suggestions
  if (!hasEmergencyFund) {
    const targetFund = (monthlyExpenses * 6).toLocaleString();
    suggestions.push(
      `You don't have an adequate emergency fund. Build a reserve of ₹${targetFund} (6 months of expenses: ₹${monthlyExpenses.toLocaleString()}/month) in a liquid savings account or liquid mutual fund.`
    );
  } else {
    suggestions.push('Your emergency fund is healthy. Review it annually as expenses grow.');
  }

  // Debt ratio suggestions (debtRatio is fraction of income)
  if (debtRatio > 0.50) {
    suggestions.push(
      `Your debt payments are ${Math.round(debtRatio * 100)}% of income — this is high and leaves little room for savings. Focus on repaying the highest interest-rate debt first (avalanche method).`
    );
  } else if (debtRatio > 0.40) {
    suggestions.push(
      `Debt-to-income ratio is ${Math.round(debtRatio * 100)}%. Try to keep it below 40%. Avoid taking new loans until existing ones are reduced.`
    );
  } else if (debtRatio > 0) {
    suggestions.push(`Debt-to-income ratio is manageable at ${Math.round(debtRatio * 100)}%. Continue making timely payments to maintain a healthy credit profile.`);
  } else {
    suggestions.push('You have no debt payments — excellent! This gives you full flexibility to invest.');
  }

  // General next step
  suggestions.push('Consider consulting a SEBI-registered investment advisor for a personalized financial plan.');

  return suggestions;
}

export class FinancialHealthTools {
  @Tool({
    name: 'calculate_financial_health',
    description: 'Calculate a financial health score (0–100) based on savings rate, emergency fund adequacy, and debt-to-income ratio. Returns a score, sub-scores, score band (Poor/Fair/Good/Excellent), and dynamic personalised suggestions.',
    inputSchema: FinancialHealthInput
  })
  async calculateFinancialHealth(input: any, ctx: ExecutionContext) {
    ctx.logger.info('calculate_financial_health called', { input });

    const monthlyIncome   = Math.max(1, input.monthlyIncome);
    const monthlyExpenses = Math.max(0, input.monthlyExpenses);
    const savings         = Math.max(0, input.savings);
    const monthlyDebt     = Math.max(0, input.monthlyDebtPayment);
    const emergencyMonths = input.emergencyFundMonths ?? 6;

    // --- Sub-score calculations ---
    const savingsRate  = savings / monthlyIncome;  // fraction
    const debtRatio    = monthlyDebt / monthlyIncome; // fraction

    const hasEmergencyFund = savings >= emergencyMonths * monthlyExpenses;
    const emergencyScore   = hasEmergencyFund ? 1 : Math.min(1, savings / Math.max(1, emergencyMonths * monthlyExpenses));

    // Weighted composite score (50% savings rate, 30% emergency fund, 20% debt control)
    const rawScore = (
      0.50 * Math.min(1, savingsRate / 0.30) +   // 30% target savings rate = full score
      0.30 * emergencyScore +
      0.20 * Math.max(0, 1 - debtRatio / 0.50)  // 50% debt ratio = 0 score
    );

    const score = Math.max(0, Math.min(100, Math.round(rawScore * 100)));
    const band  = getScoreBand(score);

    const suggestions = generateSuggestions(
      savingsRate,
      hasEmergencyFund,
      debtRatio,
      input.monthlyIncome,
      monthlyExpenses
    );

    return {
      score,
      band,
      subScores: {
        savingsRate:   Math.round(savingsRate * 100),
        emergencyFund: Math.round(emergencyScore * 100),
        debtRatio:     Math.round(Math.min(1, debtRatio) * 100)
      },
      suggestions,
      risk_note: 'This financial health score is illustrative and for educational purposes only. It is not a substitute for professional financial advice.',
      educational_only: true as const
    };
  }
}
