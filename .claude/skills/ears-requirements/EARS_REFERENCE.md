# EARS Reference: Core Methodology

**Source**: <https://alistairmavin.com/ears/>

## What is EARS

The Easy Approach to Requirements Syntax (EARS) is "a mechanism to gently constrain textual requirements." It provides structured guidance through patterns, syntax, keywords, and rulesets to help authors compose higher-quality textual requirements in a consistent format.

## Development History

Alistair Mavin and Rolls-Royce PLC colleagues created EARS while analyzing airworthiness regulations for jet engine control systems. They discovered requirements naturally followed similar structural patterns and were most readable when clauses appeared in consistent order. The notation was published in 2009 and has since gained worldwide adoption.

## Key Benefits

- Reduces ambiguity and imprecision inherent in unconstrained natural language
- Requires little training overhead
- No specialist tool is necessary
- Produces highly readable, consistent requirements
- Particularly effective for non-native English speakers
- Prevents errors from propagating through development

## Generic EARS Structure

All EARS requirements follow this consistent ordering:

```
While <optional pre-condition>, when <optional trigger>, the <system name> shall <system response>
```

**Requirements must contain:**

- Zero or many preconditions
- Zero or one trigger
- One system name
- One or many system responses

## The Five Core Patterns

### 1. Ubiquitous Requirements

Always active with no keyword needed.

**Format:** `The <system name> shall <system response>`

**Example:** The mobile phone shall have a mass of less than XX grams.

**When to Use:** Always-active requirements with no conditions

---

### 2. State-Driven Requirements

Active while a specified state remains true (keyword: **While**)

**Format:** `While <precondition(s)>, the <system name> shall <system response>`

**Example:** While there is no card in the ATM, the ATM shall display "insert card."

**When to Use:** Requirements that apply during specific system states

---

### 3. Event-Driven Requirements

Specify responses to triggering events (keyword: **When**)

**Format:** `When <trigger>, the <system name> shall <system response>`

**Example:** When "mute" is selected, the laptop shall suppress all audio output.

**When to Use:** Requirements triggered by specific events

---

### 4. Optional Feature Requirements

Apply only when specific features are included (keyword: **Where**)

**Format:** `Where <feature is included>, the <system name> shall <system response>`

**Example:** Where the car has a sunroof, the car shall have a sunroof control panel.

**When to Use:** Requirements for optional or configurable features

---

### 5. Unwanted Behaviour Requirements

Specify responses to undesired situations (keywords: **If/Then**)

**Format:** `If <trigger>, then the <system name> shall <system response>`

**Example:** If an invalid credit card number is entered, then the website shall display "please re-enter."

**When to Use:** Error handling, edge cases, prevention

---

## Complex Requirements

Multiple EARS keywords combine for richer behavior:

```
While <precondition(s)>, When <trigger>, the <system name> shall <system response>
```

**Example:** While the aircraft is on ground, when reverse thrust is commanded, the engine control system shall enable reverse thrust.

## Organizational Adoption

EARS is deployed globally by organizations including Airbus, Bosch, Dyson, Honeywell, Intel, NASA, Rolls-Royce, and Siemens, and is taught at universities worldwide.

---

**Note**: This reference document distills the core EARS methodology from the official source. For complete details, research papers, and additional resources, visit <https://alistairmavin.com/ears/>
