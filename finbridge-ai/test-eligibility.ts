import 'reflect-metadata';
import { EligibilityTools } from './src/modules/eligibility/eligibility.tools.js';

async function run() {
  const tools = new EligibilityTools();
  
  // Mock ExecutionContext
  const ctx: any = {
    logger: {
      info: (msg: string, meta: any) => console.log(`[INFO] ${msg}`, meta),
      warn: (msg: string, meta: any) => console.log(`[WARN] ${msg}`, meta),
      error: (msg: string, meta: any) => console.error(`[ERROR] ${msg}`, meta),
    }
  };

  const input = {
    age: 35,
    monthlyIncome: 50000,
    gender: 'female',
    occupation: 'salaried',
    hasBankAccount: true,
    isTaxPayer: false
  };

  console.log('Testing check_scheme_eligibility with:', input);
  try {
    const result = await tools.checkSchemeEligibility(input, ctx);
    console.log('\n--- RESULT ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('--- END RESULT ---');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

run();
