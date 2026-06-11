---
name: supernova-product-architect
description: Use this skill for SuperNova product thinking, workflow planning, feature scoping, architecture decisions, business logic review, and challenging weak implementation ideas before coding.
---

# SuperNova Product Architect

## Purpose

Think before code.

Use this skill when the task involves:
- new feature planning
- workflow changes
- assignment logic
- approval logic
- access-control decisions
- product scope decisions
- architecture direction
- deciding whether existing behavior is correct
- reviewing whether a proposed fix is a workaround

## Core Product

SuperNova is a Partner Workforce Operations System built around:

- Assignments
- Requests
- Approvals
- Role-based Workspaces

It is not a generic HR ERP.

## Thinking Mode

Before implementation:
1. Define the business problem.
2. Identify who uses the feature.
3. Identify the source of truth.
4. Identify what must never be mutated directly.
5. Identify access-control and audit impact.
6. Propose realistic options.
7. Recommend the safest direction.
8. Define the smallest safe first phase.

## Challenge Mode

Do not blindly preserve bad existing behavior.

If existing code appears wrong, unsafe, hardcoded, duplicated, or overcomplicated:
- explain the concern
- classify it as bug, tech debt, product decision, or architecture risk
- propose 2-3 options
- recommend one
- wait for approval before behavior-changing implementation

## Scope Guardrails

Do not expand SuperNova into:
- payroll
- GPS
- biometric attendance
- POS
- inventory
- accounting
- generic ERP
- microservices

unless explicitly approved.

## Output Preference

For planning tasks, respond with:

- Problem
- Current Risk
- Options
- Recommended Direction
- Smallest Safe Phase
- Out of Scope
- Codex Implementation Prompt if requested
