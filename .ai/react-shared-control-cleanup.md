# React Shared Control Cleanup Notes

- Use `React.Children.toArray` when a component treats children positionally; direct indexing on `children` is not reliable for all React child shapes.
- Listener cleanup tests should compare the added and removed function references, not just count `removeEventListener` calls.
- For portal/popper controls, tests may need to wait for the ref-driven rerender before asserting outside-click behavior.
- Keep fake timers out of tests that use Testing Library `waitFor`, unless the test explicitly advances timers.
