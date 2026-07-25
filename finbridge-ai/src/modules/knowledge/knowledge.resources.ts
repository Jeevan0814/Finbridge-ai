import { ResourceDecorator as Resource, ExecutionContext } from '@nitrostack/core';
import * as fs from 'fs';
import * as path from 'path';

export class KnowledgeResources {
  @Resource({
    uri: 'finbridge://schemes',
    name: 'FinBridge Schemes',
    description: 'List of public schemes',
    mimeType: 'application/json'
  })
  async getSchemes(uri: string, ctx: ExecutionContext) {
    ctx.logger.info('Resource finbridge://schemes requested');
    const file = path.join(process.cwd(), 'data', 'schemes.json');
    const text = fs.readFileSync(file, 'utf-8');
    return { contents: [{ uri, mimeType: 'application/json', text }] };
  }

  @Resource({
    uri: 'finbridge://glossary',
    name: 'FinBridge Glossary',
    description: 'Glossary for demo terms',
    mimeType: 'application/json'
  })
  async getGlossary(uri: string, ctx: ExecutionContext) {
    ctx.logger.info('Resource finbridge://glossary requested');
    const file = path.join(process.cwd(), 'data', 'glossary.json');
    const text = fs.readFileSync(file, 'utf-8');
    return { contents: [{ uri, mimeType: 'application/json', text }] };
  }
}
