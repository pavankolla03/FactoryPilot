import { Injectable } from '@nestjs/common';
import { AnthropicProvider } from './anthropic-provider';
import type { ILLMProvider } from './types';
import { AzureOpenAIProvider } from './azure-openai-provider';
import { OpenAIProvider } from './openai-provider';
import { OpenRouterProvider } from './openrouter-provider';
import { SelfHostedProvider } from './self-hosted-provider';

@Injectable()
export class LlmProviderFactory {
  private provider: ILLMProvider | null = null;

  getProvider(): ILLMProvider {
    if (this.provider) {
      return this.provider;
    }

    const key = (process.env.LLM_PROVIDER || 'self-hosted').toLowerCase();

    switch (key) {
      case 'openai':
        this.provider = new OpenAIProvider();
        break;
      case 'azure-openai':
        this.provider = new AzureOpenAIProvider();
        break;
      case 'anthropic':
        this.provider = new AnthropicProvider();
        break;
      case 'openrouter':
        this.provider = new OpenRouterProvider();
        break;
      case 'self-hosted':
      default:
        this.provider = new SelfHostedProvider();
        break;
    }

    return this.provider;
  }
}
