import type { CodebaseContext, SolutionSpecV2, TShirtSize, TShirtSizeValue, ConfidenceLevel } from './types.js';

/** Size ordering for comparisons */
const SIZE_ORDER: TShirtSizeValue[] = ['XS', 'S', 'M', 'L', 'XL'];

/**
 * Estimate the complexity of implementing a solution based on codebase context and spec.
 * Returns a T-shirt size estimate with reasoning and confidence.
 */
export async function estimateComplexity(
  context: CodebaseContext,
  spec: SolutionSpecV2
): Promise<TShirtSize> {
  const factors: string[] = [];

  // Count relevant files
  const highRelevanceFiles = context.files.filter(f => f.relevance === 'high').length;
  const mediumRelevanceFiles = context.files.filter(f => f.relevance === 'medium').length;
  const totalFiles = highRelevanceFiles + Math.floor(mediumRelevanceFiles / 2);
  factors.push(`${totalFiles} files likely to be modified`);

  // Count scope items
  const scopeItems = spec.scope.included.length;
  factors.push(`${scopeItems} scope items to implement`);

  // Count integration points
  const integrationDeps = context.dependencies.filter(d =>
    d.type === 'production' && isIntegrationDependency(d.name)
  ).length;
  if (integrationDeps > 0) {
    factors.push(`${integrationDeps} external integration(s)`);
  }

  // Count edge cases
  const criticalEdgeCases = spec.edgeCases.filter(e => e.severity === 'critical' || e.severity === 'high').length;
  if (criticalEdgeCases > 0) {
    factors.push(`${criticalEdgeCases} critical/high edge cases to handle`);
  }

  // Count technical constraints
  const constraintCount = spec.technicalConstraints.length;
  if (constraintCount > 0) {
    factors.push(`${constraintCount} technical constraint(s)`);
  }

  // Calculate base complexity
  let size = calculateBaseComplexity(
    totalFiles,
    scopeItems,
    constraintCount,
    spec.edgeCases.length
  );

  // Adjust for integrations
  size = adjustForIntegrations(size, context, spec);

  // Determine confidence based on context completeness
  const confidence = determineConfidence(context, spec);

  // Build reasoning
  const reasoning = buildReasoning(size, factors, context, spec);

  return {
    size,
    reasoning,
    confidence,
    factors,
  };
}

/**
 * Calculate base complexity from metrics
 */
export function calculateBaseComplexity(
  fileCount: number,
  scopeItemCount: number,
  constraintCount: number,
  edgeCaseCount: number
): TShirtSizeValue {
  // Calculate a weighted score
  const score =
    fileCount * 1.5 +
    scopeItemCount * 2 +
    constraintCount * 1 +
    edgeCaseCount * 0.5;

  if (score <= 3) return 'XS';
  if (score <= 6) return 'S';
  if (score <= 12) return 'M';
  if (score <= 20) return 'L';
  return 'XL';
}

/**
 * Adjust size based on integration complexity
 */
export function adjustForIntegrations(
  baseSize: TShirtSizeValue,
  context: CodebaseContext,
  spec: SolutionSpecV2
): TShirtSizeValue {
  const currentIdx = SIZE_ORDER.indexOf(baseSize);

  // Count integration factors
  const integrationDeps = context.dependencies.filter(d =>
    d.type === 'production' && isIntegrationDependency(d.name)
  ).length;

  const integrationConstraints = spec.technicalConstraints.filter(c =>
    c.toLowerCase().includes('integrat') ||
    c.toLowerCase().includes('api') ||
    c.toLowerCase().includes('external')
  ).length;

  // Calculate adjustment
  let adjustment = 0;
  if (integrationDeps >= 2) adjustment += 1;
  if (integrationConstraints >= 2) adjustment += 1;

  // Apply adjustment with cap
  const newIdx = Math.min(currentIdx + adjustment, SIZE_ORDER.length - 1);
  return SIZE_ORDER[newIdx];
}

/**
 * Determine confidence level based on context completeness
 */
function determineConfidence(
  context: CodebaseContext,
  spec: SolutionSpecV2
): ConfidenceLevel {
  let confidenceScore = 0;

  // More files discovered = more confidence
  if (context.files.length >= 3) confidenceScore += 1;
  if (context.files.length >= 6) confidenceScore += 1;

  // Patterns identified = better understanding
  if (context.patterns.length >= 1) confidenceScore += 1;

  // Clear scope = better estimate
  if (spec.scope.included.length > 0 && spec.scope.excluded.length > 0) confidenceScore += 1;

  // Technical constraints identified = clearer picture
  if (spec.technicalConstraints.length >= 1) confidenceScore += 1;

  if (confidenceScore >= 4) return 'high';
  if (confidenceScore >= 2) return 'medium';
  return 'low';
}

/**
 * Build human-readable reasoning for the estimate
 */
function buildReasoning(
  size: TShirtSizeValue,
  factors: string[],
  context: CodebaseContext,
  spec: SolutionSpecV2
): string {
  const sizeDescriptions: Record<TShirtSizeValue, string> = {
    XS: 'Very small change, likely a config tweak or minor modification',
    S: 'Small feature, touching a few files with minimal complexity',
    M: 'Medium-sized feature requiring changes across multiple components',
    L: 'Large feature with significant scope, integrations, or complexity',
    XL: 'Major feature or system change with extensive modifications',
  };

  const base = sizeDescriptions[size];
  const factorSummary = factors.slice(0, 3).join('; ');

  let reasoning = `${base}. Key factors: ${factorSummary}.`;

  // Add architecture context if available
  if (context.architecture) {
    reasoning += ` Working within ${context.architecture.toLowerCase()}.`;
  }

  return reasoning;
}

/**
 * Check if a dependency is likely an external integration
 */
function isIntegrationDependency(name: string): boolean {
  const integrationKeywords = [
    'stripe', 'twilio', 'sendgrid', 'aws-sdk', 'firebase',
    'redis', 'mongodb', 'pg', 'mysql', 'elasticsearch',
    'kafka', 'rabbitmq', 'socket.io', 'graphql', 'oauth',
    'auth0', 'okta', 'sentry', 'datadog', 'newrelic',
  ];

  const lowerName = name.toLowerCase();
  return integrationKeywords.some(kw => lowerName.includes(kw));
}
