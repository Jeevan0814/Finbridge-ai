import { ToolDecorator as Tool, ExecutionContext } from '@nitrostack/core';
import { CheckSchemeEligibilityInput, EligibilityResult } from '../../shared/contracts.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Loads schemes.json from the data directory.
 * Cached at module level to avoid repeated file I/O on every tool call.
 */
let _schemes: any[] = [];
let _schemesLoaded = false;

function getSchemes(): any[] {
  if (!_schemesLoaded) {
    const file = path.join(process.cwd(), 'data', 'schemes.json');
    const raw = fs.readFileSync(file, 'utf-8');
    _schemes = JSON.parse(raw) as any[];
    _schemesLoaded = true;
  }
  return _schemes;
}

export class EligibilityTools {
  @Tool({
    name: 'check_scheme_eligibility',
    description: 'Deterministically check eligibility for all 7 government schemes (PMJDY, APY, PMJJBY, PMSBY, SSY, SCSS, NPS) based on user profile. Reads scheme rules from schemes.json and evaluates each rule. Returns dynamically computed eligible and ineligible lists with reasons.',
    inputSchema: CheckSchemeEligibilityInput
  })
  async checkSchemeEligibility(input: any, ctx: ExecutionContext) {
    ctx.logger.info('check_scheme_eligibility called', { input });

    const schemes = getSchemes();

    const eligible: Array<{ schemeId: string; schemeName: string; reason: string }> = [];
    const ineligible: Array<{ schemeId: string; schemeName: string; failedCondition: string }> = [];

    for (const scheme of schemes) {
      const e = scheme.eligibility;
      const failedReasons: string[] = [];

      // Rule 1 — Minimum age
      if (e.minimumAge !== null && input.age < e.minimumAge) {
        failedReasons.push(
          `Minimum age required is ${e.minimumAge} years (applicant is ${input.age})`
        );
      }

      // Rule 2 — Maximum age
      if (e.maximumAge !== null && input.age > e.maximumAge) {
        failedReasons.push(
          `Maximum age allowed is ${e.maximumAge} years (applicant is ${input.age})`
        );
      }

      // Rule 3 — Gender restriction
      if (e.gender !== 'any' && e.gender !== input.gender) {
        failedReasons.push(
          `Scheme is restricted to ${e.gender} beneficiaries (applicant gender: ${input.gender})`
        );
      }

      // Rule 4 — Bank account requirement
      if (e.requiresExistingBankAccount && !input.hasBankAccount) {
        failedReasons.push('An existing bank account is required to enrol in this scheme');
      }

      // Rule 5 — Income ceiling
      if (e.incomeCeiling !== null && input.monthlyIncome > e.incomeCeiling) {
        failedReasons.push(
          `Monthly income of INR ${input.monthlyIncome.toLocaleString()} exceeds ceiling of INR ${e.incomeCeiling.toLocaleString()}`
        );
      }

      // Rule 6 — Taxpayer exclusion
      if (e.taxpayerExcluded && input.isTaxPayer) {
        failedReasons.push('Income taxpayers are not eligible for this scheme');
      }

      // Rule 7 — Occupation restriction (empty array = no restriction)
      if (
        Array.isArray(e.occupationEligibility) &&
        e.occupationEligibility.length > 0 &&
        !e.occupationEligibility.includes(input.occupation)
      ) {
        failedReasons.push(
          `Occupation must be one of: ${e.occupationEligibility.join(', ')} (applicant occupation: ${input.occupation})`
        );
      }

      if (failedReasons.length === 0) {
        // Build a human-readable eligibility reason
        const reasonParts: string[] = [];
        reasonParts.push(`Age ${input.age} is within the ${e.minimumAge ?? 0}–${e.maximumAge ?? 'no limit'} year range`);
        if (!e.requiresExistingBankAccount) {
          reasonParts.push('No pre-existing bank account required');
        } else {
          reasonParts.push('Bank account requirement met');
        }
        if (e.gender !== 'any') {
          reasonParts.push(`Gender requirement (${e.gender}) met`);
        }
        if (e.taxpayerExcluded === false) {
          reasonParts.push('No taxpayer restriction applies');
        }

        eligible.push({
          schemeId: scheme.schemeId,
          schemeName: scheme.schemeName,
          reason: reasonParts.join('; ')
        });
      } else {
        ineligible.push({
          schemeId: scheme.schemeId,
          schemeName: scheme.schemeName,
          failedCondition: failedReasons.join('; ')
        });
      }
    }

    return {
      eligible,
      ineligible,
      risk_note:
        'This is a deterministic eligibility check based on official government scheme rules. Always verify with the official government source or a qualified advisor before applying.',
      educational_only: true as const
    };
  }
}
