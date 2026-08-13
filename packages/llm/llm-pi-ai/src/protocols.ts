/**
 * Wire protocols a configured route or model may name, mapped to pi-ai's
 * lazily loaded implementations. Each entry is the factory that pi-ai's
 * matching provider factory uses, so a hand-declared route reaches exactly the
 * implementation a catalog route would.
 *
 * The table is deliberately narrow: the protocols a hand-declared route
 * actually reaches for today, each completely describable with a key, an
 * endpoint, and headers. Bedrock signs with SigV4 over AWS credentials and a
 * region, Vertex needs a project, a location, and application-default
 * credentials, Azure needs provider environment plus an api-version, and Codex
 * authenticates through OAuth — none of which this configuration shape can
 * express, so offering them would hand back a provider that cannot
 * authenticate. The remainder are absent for want of a consumer rather than a
 * blocker: each is one line here once a deployment needs it. Catalog routes
 * still reach every protocol through their own provider; only an explicit
 * override is refused.
 *
 * @module dsh-llm-pi-ai/protocols
 */

import type { ProviderStreams } from '@earendil-works/pi-ai'
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy'

/** One wire protocol a configured route or model may name, mapped to its implementation factory. */
const PROTOCOLS: Readonly<Record<string, () => ProviderStreams>> = {
  'openai-completions': openAICompletionsApi,
  'openai-responses': openAIResponsesApi,
  'anthropic-messages': anthropicMessagesApi,
}

/**
 * Every wire protocol a configured route or model may name, most-reached
 * first. The order is the table's and therefore stable; a configuration
 * surface offering a choice presents the first as its default, which is why
 * the protocol a hand-declared gateway most often speaks — and the one
 * endpoint interrogation can read — leads.
 * @returns the supported protocol identifiers.
 */
export function supportedProtocols(): readonly string[] {
  return Object.keys(PROTOCOLS)
}

/**
 * The implementation factory for one nameable protocol.
 * @param api - the protocol identifier.
 * @returns the factory, or `undefined` for a protocol this build cannot serve.
 */
export function protocolFactory(api: string): (() => ProviderStreams) | undefined {
  return PROTOCOLS[api]
}
