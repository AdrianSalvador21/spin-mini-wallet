# Documentation

Short, diagram-first guides to how the Spin Mini Wallet works. Start with the root [`README.md`](../README.md) to run it and [`DECISIONS.md`](../DECISIONS.md) for the reasons behind it.

| Guide | What it covers |
| --- | --- |
| [Architecture](./architecture.md) | Layers and their enforced boundaries, folders, the backend request pipeline, the data model, and where to find each piece |
| [Data flows](./flows.md) | Login, Home SSR with streaming and hydration, and a transfer: success, retry with the same idempotency key, timeout with the status lookup |
| [State](./state.md) | Where each piece of client state lives and why, the submission state machine, the wizard step guard, and route access |
| [DEV panel](./dev-panel.md) | How to force each transfer outcome and each loading or error state on demand |

The full contracts, decisions and their history live in [`specs/`](../specs/README.md).
