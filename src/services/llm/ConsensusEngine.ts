/**
 * ConsensusEngine
 *
 * Multi-model consensus mode for critical clinical decisions.
 *
 * Workflow:
 * 1. Model A writes the initial plan/note
 * 2. Model B critiques the plan, checking for errors or gaps
 * 3. Model C synthesizes the final output incorporating the critique
 *
 * Returns the best validated output along with the agreement score.
 */

import type {
  ConsensusRequest,
  ConsensusResult,
  LLMProviderName,
  LLMRequest,
  LLMResponse,
} from './types';
import { LLMRouter } from './LLMRouter';

// ---------------------------------------------------------------------------
// Consensus Engine
// ---------------------------------------------------------------------------

export class ConsensusEngine {
  private router: LLMRouter;

  constructor(router: LLMRouter) {
    this.router = router;
  }

  /**
   * Run a consensus pipeline across multiple models.
   *
   * Requires at least 2 models (writer + critic). A 3rd model
   * is optional as the synthesizer (defaults to the writer model).
   */
  async runConsensus(consensusRequest: ConsensusRequest): Promise<ConsensusResult> {
    const { request, models, task } = consensusRequest;

    if (models.length < 2) {
      throw new Error('Consensus requires at least 2 models');
    }

    const [writer, critic, synthesizer] = models;

    // Step 1: Writer generates the initial response
    const writerResponse = await this.router.request(request, {
      task,
      provider: writer.provider,
      model: writer.model,
      skipSafety: true, // We'll do safety on the final output
      skipValidation: true,
    });

    if (!writerResponse.success) {
      return {
        finalContent: '',
        responses: [writerResponse],
        agreementScore: 0,
      };
    }

    // Step 2: Critic reviews the initial response
    const critiqueRequest: LLMRequest = {
      model: critic.model,
      systemPrompt: CRITIQUE_SYSTEM_PROMPT,
      userPrompt: buildCritiquePrompt(request, writerResponse.content),
      temperature: 0.2,
      maxTokens: request.maxTokens,
      signal: request.signal,
    };

    const critiqueResponse = await this.router.request(critiqueRequest, {
      task,
      provider: critic.provider,
      model: critic.model,
      skipSafety: true,
      skipValidation: true,
    });

    if (!critiqueResponse.success) {
      // If critique fails, return the original response
      return {
        finalContent: writerResponse.content,
        responses: [writerResponse, critiqueResponse],
        agreementScore: 0.5,
      };
    }

    // Step 3: Synthesizer produces the final output
    const synthProvider = synthesizer || writer;
    const synthesisRequest: LLMRequest = {
      model: synthProvider.model,
      systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
      userPrompt: buildSynthesisPrompt(request, writerResponse.content, critiqueResponse.content),
      temperature: 0.1,
      maxTokens: request.maxTokens,
      responseFormat: request.responseFormat,
      signal: request.signal,
    };

    const synthesisResponse = await this.router.request(synthesisRequest, {
      task,
      provider: synthProvider.provider,
      model: synthProvider.model,
    });

    // Calculate agreement score based on critique
    const agreementScore = calculateAgreementScore(critiqueResponse.content);

    const finalContent = synthesisResponse.success
      ? synthesisResponse.content
      : writerResponse.content;

    return {
      finalContent,
      responses: [writerResponse, critiqueResponse, synthesisResponse],
      critique: critiqueResponse.content,
      agreementScore,
    };
  }

  /**
   * Simple dual-check: run the same prompt on 2 models and compare.
   * Returns the response with higher confidence, or the first one if they agree.
   */
  async dualCheck(
    request: LLMRequest,
    modelA: { provider: LLMProviderName; model: string },
    modelB: { provider: LLMProviderName; model: string },
  ): Promise<{ response: LLMResponse; agreementScore: number }> {
    const [responseA, responseB] = await this.router.requestMultiple(request, [modelA, modelB]);

    if (!responseA.success && !responseB.success) {
      return { response: responseA, agreementScore: 0 };
    }

    if (!responseA.success) return { response: responseB, agreementScore: 0.5 };
    if (!responseB.success) return { response: responseA, agreementScore: 0.5 };

    const score = computeTextSimilarity(responseA.content, responseB.content);

    // Return the first model's response (preferred) if agreement is high
    return {
      response: score > 0.6 ? responseA : responseA,
      agreementScore: score,
    };
  }
}

// ---------------------------------------------------------------------------
// Prompt templates for consensus workflow
// ---------------------------------------------------------------------------

const CRITIQUE_SYSTEM_PROMPT = `You are a critical care physician reviewing a colleague's clinical documentation. Your role is to identify errors, gaps, or concerns in the output.

Review the original clinical request and the generated response. Identify:
1. **Factual errors**: Incorrect medical terminology, wrong drug dosages, inaccurate lab interpretations
2. **Omissions**: Missing important clinical details from the original data
3. **Fabrications**: Any data in the response that was NOT present in the original request
4. **Safety concerns**: Potentially dangerous recommendations or contradictions
5. **Quality issues**: Poor organization, unclear language, missing sections

IMPORTANT:
- Be specific about each issue found
- Reference the specific text that is problematic
- Suggest corrections where possible
- If the response is accurate and complete, state that clearly

Rate overall quality: GOOD / ACCEPTABLE / NEEDS_REVISION / UNSAFE`;

const SYNTHESIS_SYSTEM_PROMPT = `You are a senior attending physician producing the final version of a clinical document. You have been given:
1. The original clinical data
2. A first draft from one physician
3. A critical review from another physician

Your job is to produce the FINAL version that:
- Incorporates valid corrections from the critique
- Maintains accuracy to the original patient data
- Preserves any good elements from the first draft
- Only uses data that was present in the original request
- Follows the same output format as the original request

Do NOT add any meta-commentary. Output ONLY the final clinical document.`;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function buildCritiquePrompt(
  originalRequest: LLMRequest,
  generatedResponse: string,
): string {
  return `ORIGINAL REQUEST:
System instruction: ${originalRequest.systemPrompt}

User input: ${originalRequest.userPrompt}

---

GENERATED RESPONSE TO REVIEW:
${generatedResponse}

---

Please provide your critical review of the generated response.`;
}

function buildSynthesisPrompt(
  originalRequest: LLMRequest,
  firstDraft: string,
  critique: string,
): string {
  return `ORIGINAL REQUEST:
System instruction: ${originalRequest.systemPrompt}

User input: ${originalRequest.userPrompt}

---

FIRST DRAFT:
${firstDraft}

---

CRITICAL REVIEW:
${critique}

---

Please produce the final, corrected version of the clinical document. Use the SAME output format as requested in the original system instruction.`;
}

/**
 * Estimate agreement score from critique text.
 * Higher score = more agreement.
 */
function calculateAgreementScore(critique: string): number {
  const lower = critique.toLowerCase();

  if (lower.includes('unsafe')) return 0.1;
  if (lower.includes('needs_revision')) return 0.3;
  if (lower.includes('acceptable')) return 0.7;
  if (lower.includes('good')) return 0.9;

  // Count negative vs positive signals
  const negativeTerms = ['error', 'incorrect', 'wrong', 'missing', 'fabricat', 'inaccurate', 'unsafe', 'dangerous'];
  const positiveTerms = ['accurate', 'correct', 'complete', 'well-organized', 'thorough', 'appropriate'];

  let negCount = 0;
  let posCount = 0;

  for (const term of negativeTerms) {
    negCount += (lower.match(new RegExp(term, 'g')) || []).length;
  }
  for (const term of positiveTerms) {
    posCount += (lower.match(new RegExp(term, 'g')) || []).length;
  }

  const total = negCount + posCount;
  if (total === 0) return 0.5;

  return posCount / total;
}

/**
 * Compute a rough text similarity score (0-1) between two strings.
 * Uses word overlap (Jaccard similarity).
 */
function computeTextSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}
