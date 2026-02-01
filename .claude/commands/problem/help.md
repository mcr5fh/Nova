---
description: "Explain the problem advisor workflow"
---

# Problem Advisor

The Problem Advisor helps you sharpen vague problem statements into clear, testable hypotheses through structured conversation.

## How It Works

The advisor tracks **6 dimensions** of a well-defined problem:

| Dimension | Goal | Threshold |
|-----------|------|-----------|
| **Problem Clarity** | Single-sentence customer pain point | Strong |
| **Customer & Context** | Specific user segment + situational context | Strong |
| **Business Impact** | Quantified revenue/cost/strategic impact | Strong |
| **Severity & Frequency** | Quantified frequency and impact level | Partial |
| **Root Cause** | Fundamental reason the problem exists | Partial |
| **Validation** | Concrete validation approach | Partial |

As you answer questions, each dimension's coverage progresses: `not_started` → `weak` → `partial` → `strong`

When all dimensions meet their thresholds, the advisor will offer to generate your final problem statement.

## Commands

- `/problem:plan <name>` - Start a new problem interview
- `/problem:resume` - Resume an interrupted interview
- `/problem:cleanup` - Clean up interview state files

## Tips

- Be specific about WHO experiences the problem
- Quantify severity and frequency when possible
- Explain the business impact in measurable terms
- Describe how you'd validate this problem exists
- If you jump to solutions, expect to be redirected back to the underlying problem
