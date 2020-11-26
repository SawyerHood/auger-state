![auger-state logo](./logo.svg)

> Delightful, hook-first, global state management for React that lets components drill down and subscribe to only the parts of the state that they need.

[![NPM](https://img.shields.io/npm/v/auger-state.svg)](https://www.npmjs.com/package/auger-state)

## Overview

An auger is a large drilled used to bore holes in the ground. `auger-state` lets your components drill down and subscribe only to parts of your global state. `auger-state` merges the benefits of a global app-level store and merges it with the performance of decentralized state management.

At the moment `auger-state` is still a new library and the API will likely change. I would stick to using it for internal tools and personal projects until it becomes more battle tested.

## Install

```bash
npm install --save auger-state
```

## Example

```tsx
import React from 'react';
import {useAuger, AugerStore} from 'auger-state';

type Item = {id: string; name: string};

type State = {
  counter: {value: number};
  items: Item[];
};

const INITIAL_STATE: State = {
  counter: {value: 5},
  items: [
    {id: 'a', count: 6, name: 'PS5'},
    {id: 'b', count: 12, name: 'Xbox Series X'},
  ],
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
            c.value++;
          })
        }>
        +
      </button>
    </div>
  );
});
```

## Backstory

In multiple times in my career I've written large, performance sensitive React apps. At Facebook I worked on a React WYSIWYG editor that let designers drag and manipulate React components visually. Now at Figma I work on a design tool that allows for users to do complex vector editing in the browser. In both of these situations you have a myriad of complex controls that need access. There is a level of convenience to keeping your application state in a global store. It makes it simpler to observe the state of your entire application and can make onboarding new engineers more streamlined. One of the major tradeoffs to a global, centralized, immutable store is that they will eventually lead to performance issues down the line once you have enough components that depend on the store. Redux tries to get around this by having you select only parts of the store you need (using useSelector), but you still have to run the selectors for every component that uses useSelector.

## Roadmap

1. Redux Dev Tools integration
2. Effect system
3. Test coverage

## License

MIT © [SawyerHood](https://github.com/SawyerHood)

## Credits

Auger icon made by [Icongeek26](https://www.flaticon.com/authors/icongeek26)
