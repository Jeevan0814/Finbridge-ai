import { Module } from '@nitrostack/core';
import { GrowthTools } from './growth.tools.js';

@Module({
  name: 'growth',
  description: 'Project investment growth',
  controllers: [GrowthTools]
})
export class GrowthModule {}
