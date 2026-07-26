# React Effect Cleanup Notes

- Use the checklists in `REACT_COMPONENT_REVIEW_PLAN.md` before changing React components.
- When an effect subscribes to an event, return the `off` cleanup from the effect body; a nested cleanup lambda that is not returned does nothing.
- Avoid `setState.bind(...)` in promise `finally` handlers. Use an explicit callback such as `() => setAwaiting(false)` so the next state is clear.
- When probing browser resources such as `AudioContext`, create one instance, read from that same instance, and close that same instance.

