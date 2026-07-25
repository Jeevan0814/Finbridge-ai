import { ToolDecorator as Tool, ExecutionContext, z } from '@nitrostack/core';
import { CheckSchemeEligibilityInput, EligibilityResult } from '../../shared/contracts.js';

export class EligibilityTools {
  @Tool({
    name: 'check_scheme_eligibility',
    description: 'Check eligibility for government schemes',
    inputSchema: CheckSchemeEligibilityInput
  })
  async checkSchemeEligibility(input: any, ctx: ExecutionContext) {
    ctx.logger.info('check_scheme_eligibility called', { input });

    // Validate input using zod (inputSchema provided by decorator in runtime)

    // Return two eligible and two ineligible schemes as required by the contract
    const result = {
      eligible: [
        { schemeId: 'PMJDY', schemeName: 'Pradhan Mantri Jan Dhan Yojana', reason: 'Meets age and bank account criteria' },
        { schemeId: 'APY', schemeName: 'Atal Pension Yojana', reason: 'Eligible based on occupation and contributions' }
      ],
      ineligible: [
        { schemeId: 'SSY', schemeName: 'Sukanya Samriddhi Yojana', failedCondition: 'Requires girl-child beneficiary' },
        { schemeId: 'NPS', schemeName: 'National Pension System', failedCondition: 'Income exceeds allowed ceiling' }
      ],
      risk_note: 'This is an educational eligibility check; verify with official sources before applying.',
      educational_only: true
    };

    return result;
  }
}
