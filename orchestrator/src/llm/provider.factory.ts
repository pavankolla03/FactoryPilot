import { Injectable } from '@nestjs/common';
import { AnthropicProvider } from './anthropic-provider';
import type { ILLMProvider } from './types';
import { AzureOpenAIProvider } from './azure-openai-provider';
import { OpenAIProvider } from './openai-provider';
import { OpenRouterProvider } from './openrouter-provider';
import { SelfHostedProvider } from './self-hosted-provider';
import { UserRoutedProvider, type UserModelConfig } from './custom-provider';

@Injectable()
export class LlmProviderFactory {
  private provider: ILLMProvider | null = null;
  private readonly userProviders = new Map<string, { key: string; provider: ILLMProvider }>();

  /**
   * BYOM (beta): wraps the platform provider with the user's own registered
   * models, routed first with automatic fallback. Cached per user and rebuilt
   * whenever their model list changes.
   */
  getProviderForUser(userId: string, models: UserModelConfig[]): ILLMProvider {
    if (models.length === 0) {
      return this.getProvider();
    }
    const key = models.map((m) => `${m.id}:${m.baseUrl}:${m.modelId}`).join('|');
    const cached = this.userProviders.get(userId);
    if (cached && cached.key === key) {
      return cached.provider;
    }
    const provider = new UserRoutedProvider(models, this.getProvider());
    this.userProviders.set(userId, { key, provider });
    return provider;
  }

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
