# Revyl Test Creator

Create end-to-end mobile UI tests using Revyl's YAML format for the HYBRD app.

## Initial Response

When this command is invoked:

1. **If a description was provided as a parameter:**
   - Parse the description to understand the test scenario
   - Ask any clarifying questions needed
   - Generate the test

2. **If no parameters provided, ask:**

   ```
   I'll help you create a Revyl E2E test. Please describe:
   1. What user journey or feature are you testing?
   2. What should the expected outcome be?

   Example: "Test that a free user sees the paywall when trying to accept a training plan"
   ```

## Test Structure Reference

Revyl tests use this YAML format:

```yaml
test:
  metadata:
    name: string                    # Required: '[User Type] Brief description'
    platform: enum                  # Required: "ios" | "android"

  build:
    name: string                    # Required: "ios" | "android"
    pinned_version: string          # Optional: pin to specific build version

  blocks:
    - # Block objects (see definitions below)
```

## Block Types

### instructions

Actions the AI agent performs. Use high-level instructions when possible.

```yaml
- type: instructions
  step_description: string          # Required: natural language instruction
```

Examples:

- `Complete the sign up flow with email test@example.com`
- `Go to the Plan tab`
- `Tap the "Button Name" button`
- `Input "text" into the email field`

### validation

Assertions to verify state. Use broad validations rather than specific UI element hunting.

```yaml
- type: validation
  step_description: string          # Required: condition to validate
```

Examples:

- `Validate that the home screen is visible`
- `Validate that login was successful`
- `Validate that the email input has the exact string "test@example.com"`
- `Validate that you reach the paywall`

### extraction

Extract values from the screen to use later via variables.

```yaml
- type: extraction
  step_description: string          # Required: what to extract
  variable_name: string             # Required: kebab-case format
```

Example:

```yaml
- type: extraction
  step_description: "The product price displayed on screen"
  variable_name: product-price
```

### manual

System-level actions that don't require AI interpretation.

```yaml
- type: manual
  step_type: enum                   # Required: wait | open_app | kill_app | go_home
  step_description: string          # Conditional (see below)
```

**step_type values and step_description requirements:**

- `wait`: step_description must be a NUMBER (seconds as string: "3", "5", "10")
- `open_app`: step_description optional
- `kill_app`: step_description optional
- `go_home`: step_description optional

Example:

```yaml
- type: manual
  step_type: wait
  step_description: "5"
```

### if (Conditional)

Conditional branching based on screen state.

```yaml
- type: if
  condition: string                 # Required: natural language condition
  then: array                       # Required: block array to execute if true
  else: array                       # Optional: block array to execute if false
```

Example:

```yaml
- type: if
  condition: "A training plan is already displayed"
  then:
    - type: instructions
      step_description: "Reject the training plan and go to the home screen"
  else:
    - type: validation
      step_description: "Home screen is visible"
```

### while (Loop)

Repeat actions while a condition is true.

```yaml
- type: while
  condition: string                 # Required: loop condition
  body: array                       # Required: block array to repeat
```

Example:

```yaml
- type: while
  condition: "There are more items in the list"
  body:
    - type: instructions
      step_description: "Tap the next item"
    - type: extraction
      step_description: "The item name"
      variable_name: item-name
```

### code_execution

Execute a custom script (requires script UUID from Revyl dashboard).

```yaml
- type: code_execution
  step_description: string          # Required: script UUID
  variable_name: string             # Optional: store script output
```

## Variable System

Variables allow extracting values and using them in later steps.

**Critical syntax:** Double curly braces required: `{{variable-name}}`

**Definition (via extraction):**

```yaml
- type: extraction
  step_description: "The product price"
  variable_name: product-price
```

**Usage (in any step_description):**

```yaml
- type: validation
  step_description: "Total matches {{product-price}}"
```

**Naming rules:**

- Kebab-case only (`order-number`, `user-email`)
- No spaces, underscores, or special characters
- Must be extracted before use in later steps

## Available Test Users

| Email | Password | Type | Use Case |
|-------|----------|------|----------|
| `free-user-1@revyl.ai` | `iLoveHybrd99!$` | Free | Free tier testing, paywall tests |
| `subscribed-user-1@revyl.ai` | `iLoveHybrd99!$` | Subscribed | Premium feature testing |

## Test Categories

Choose the appropriate folder:

- `auth/` - Sign up, sign in, sign out, password reset
- `training-plans/` - Plan creation, viewing, modification, deletion
- `paywall/` - Subscription flows, paywall display, purchase
- `onboarding/` - New user flows, setup wizards
- `workouts/` - Logging, viewing, editing workouts
- `navigation/` - Tab switching, deep links, back navigation

## Process

### Step 1: Understand the Scenario

From the user's description, identify:

- **User type**: Free user, subscribed user, or new user
- **Starting point**: Sign in page, home screen, specific tab
- **Actions**: What steps the user takes
- **Expected outcome**: What should happen at the end

Ask clarifying questions if needed:

```
To create this test, I need to understand:
1. Should this start from a fresh sign-in, or assume the user is already logged in?
2. What specific UI elements should I verify along the way?
3. Are there any conditional paths (e.g., "if X is visible, do Y")?
```

### Step 2: Plan the Test Steps

Before writing YAML, outline the steps:

```
Here's the flow I'll create:
1. Sign in with [user type] credentials
2. Navigate to [destination]
3. Perform [action]
4. Validate [expected state]

Does this capture what you want to test?
```

### Step 3: Write the Test

Generate the YAML file with:

- Descriptive metadata name: `[User Type, State] Action, Expected Result`
- Clear step descriptions (AI-readable)
- Appropriate validation points
- Conditional handling where needed

### Step 4: Save to Correct Location

Save the test to: `frontend/revyl-tests/{category}/{filename}.yaml`

Filename pattern: `{user-type}_{action}_{outcome}.yaml`

- Use kebab-case
- Be descriptive but concise

Example: `free-user_create-training-plan_shows-paywall.yaml`

## Common Patterns

### Authentication Flow - Sign In (Dev Auth, Existing User)

```yaml
- type: instructions
  step_description: On the sign in page, Tap Show Dev Auth
- type: instructions
  step_description: Tap "existing user sign in"
- type: instructions
  step_description: Input {email} into the email box
- type: validation
  step_description: 'Validate that the email input has the exact string "{email}"'
- type: instructions
  step_description: Input "{password}" into password
- type: instructions
  step_description: Tap Sign in with email.
```

### Authentication Flow - Sign Up (Dev Auth, New User)

```yaml
- type: instructions
  step_description: On the sign in page, Tap Show Dev Auth
- type: instructions
  step_description: Tap "new user sign up"
- type: instructions
  step_description: Input {email} into the email box
- type: validation
  step_description: 'Validate that the email input has the exact string "{email}"'
- type: instructions
  step_description: Input "{password}" into password
- type: instructions
  step_description: Tap Sign up with email.
```

### Handle Existing State

```yaml
- type: if
  condition: "A training plan is displayed instead of the home screen"
  then:
    - type: instructions
      step_description: "Reject the training plan and go to the home screen"
```

### Tab Navigation

```yaml
- type: instructions
  step_description: Go to the Plan tab
```

### Completing Multi-Step Flows

```yaml
- type: instructions
  step_description: Complete the training plan onboarding flow with a "faster and
    stronger" training plan selection
```

### Paywall Validation

```yaml
- type: validation
  step_description: Validate that you reach the paywall at the end of the flow
```

### Screen Visibility

```yaml
- type: validation
  step_description: Home screen is visible
```

### Wait for Loading

```yaml
- type: manual
  step_type: wait
  step_description: "3"
```

### Extract and Validate Value

```yaml
- type: extraction
  step_description: "The workout duration displayed"
  variable_name: workout-duration
- type: validation
  step_description: "The summary shows duration of {{workout-duration}}"
```

## Writing Good Step Descriptions

**DO:**

- Use natural language the AI can understand
- Use high-level instructions: "Complete sign up flow" instead of step-by-step actions
- Use broad validations: "Login successful" vs. specific UI element hunting
- Include the exact text for inputs
- Use `{{variable-name}}` syntax for extracted values

**DON'T:**

- Use technical selectors or IDs
- Assume context from previous tests
- Leave ambiguous actions
- Use `open_app` at test start (app opens automatically)
- Use spaces or underscores in variable names (use kebab-case)

## Example Output

For request: "Test that a subscribed user can view their training plan calendar"

```yaml
test:
  metadata:
    name: '[Subscribed user] View training plan calendar'
    platform: ios
  build:
    name: ios
  blocks:
  - type: instructions
    step_description: On the sign in page, Tap Show Dev Auth
  - type: instructions
    step_description: Tap "existing user sign in"
  - type: instructions
    step_description: Input subscribed-user-1@revyl.ai into the email box
  - type: validation
    step_description: 'Validate that the email input has the exact string "subscribed-user-1@revyl.ai"'
  - type: instructions
    step_description: Input "iLoveHybrd99!$" into password
  - type: instructions
    step_description: Tap Sign in with email.
  - type: if
    condition: "An existing training plan prompt appears"
    then:
      - type: instructions
        step_description: "Dismiss it and continue to home screen"
  - type: validation
    step_description: Home screen is visible
  - type: instructions
    step_description: Go to the Plan tab
  - type: validation
    step_description: Validate that the training plan calendar is visible with scheduled workouts
```

## Final Steps

After creating the test:

1. Show the user the generated YAML
2. Ask if any adjustments are needed
3. Confirm the file location
4. Mention they can run it with: `revyl run frontend/revyl-tests/{path-to-test}.yaml`
