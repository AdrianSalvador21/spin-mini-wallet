# Specs

This project was built spec-first: every milestone was planned in a spec, approved, and then implemented step by step. The specs are the contract the code follows, and their "Decisions" sections record what was chosen and what was discarded. [`AI_USAGE.md`](../AI_USAGE.md) explains the workflow.

## Reading order

1. [`challenge.md`](./challenge.md): the original brief, transcribed, plus the approved design and the later design approvals (§8).
2. [`roadmap.md`](./roadmap.md): the milestones, their order and status.
3. [`00-architecture.md`](./00-architecture.md): the global contract (architecture, data model, API, security, testing).
4. One spec per milestone:

| Spec | Milestone |
| --- | --- |
| [01-scaffolding](./01-scaffolding.md) | Tooling, tokens, i18n, test setup and CI |
| [02-domain](./02-domain.md) | Money, validators, the three business rules |
| [03-mock-backend](./03-mock-backend.md) | JSON database, repositories, services, session primitives |
| [04-api](./04-api.md) | `/api/v1` Route Handlers, error envelope, scenarios, observability |
| [05-auth](./05-auth.md) | Login, registration, route guard, UI primitives |
| [06-home](./06-home.md) | Private shell, balance, movements, loading and error states |
| [07-transfer-flow](./07-transfer-flow.md) | The amount, recipient and review wizard |
| [08-confirmation-receipt](./08-confirmation-receipt.md) | The five outcomes, the status lookup and the receipt |
| [09-delivery](./09-delivery.md) | Audit fixes, brand improvements, deploy and documentation |

The approved visual design is in [`design/mini-wallet-design.html`](./design/mini-wallet-design.html); open it in a browser.

## Spec format

Each spec has a header (status, dependencies, date, a one-sentence objective), the scope with what is explicitly out, the data model, numbered implementation steps that each leave the app working, boolean acceptance criteria, decisions taken and discarded, and risks. A spec moves from Draft to Approved after review, and to Implemented when its pull request is merged.
