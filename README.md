# auger-state

> Delightful global state management for React that lets components subscribe to only a subset of state.

[![NPM](https://img.shields.io/npm/v/auger-state.svg)](https://www.npmjs.com/package/auger-state)

## About

## Install

```bash
npm install --save auger-state
```

## Example

```tsx
type Item = { id: string; name: string };

type State = {
  counter: { value: number };
  items: Item[];
};

const INITIAL_STATE: State = {
  counter: { value: 5 },
  items: [
    { id: 'a', count: 6, name: 'PS5' },
    { id: 'b', count: 12, name: 'Xbox Series X' }
  ]
};

const store = new AugerStore(INITIAL_STATE);

export const Counter = React.memo(() => {
  const auger = useAuger(store);
  // This component will only update when the counter updates, not when any other part of the state updates
  const [counter, updateCounter] = auger.counter.$();

  return (
    <div>
      <button
        onClick={() =>
          updateCounter((c) => {
            c++;
          })
        }
      >
        +
      </button>
    </div>
  );
});
```

## License

MIT © [SawyerHood](https://github.com/SawyerHood)
