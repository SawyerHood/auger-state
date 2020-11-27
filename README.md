![auger-state logo](https://user-images.githubusercontent.com/2380669/100394287-67cc5400-2ff1-11eb-8cb0-9ec361244cb9.png)

> Delightful, hook-first, global state management for React that lets components drill down and subscribe to only the parts of the state that they need.

[![NPM](https://img.shields.io/npm/v/auger-state.svg)](https://www.npmjs.com/package/auger-state)

# Overview

An auger is a large drilled used to bore holes in the ground. `auger-state` lets your components drill down and subscribe only to parts of your global state. `auger-state` merges the benefits of a global app-level store and merges it with the performance of decentralized state management. It is designed with Typescript in mind so you get type-safely and solid auto complete when using it.

At the moment `auger-state` is still experimental and the API will likely change. It isn't fully battle tested yet, so I would be cautious of using it in your hyper critical production app at this time.

# Why Auger State

- Define your state as a centralized plain old Javascript object.
- Only a single hook call to subscribe to part of your store.
- Don't worry about creating complex memoized selectors, only subscribe to parts of the state that you care about.
- The more subscribed components the better! Auger State scales well when thousands of components are subscribed to different parts of the store.
- Just mutate your state! Auger State uses immer to makes sure that a new immutable copy is created and only components that care about the state you changed are updated.
- Minimal api: only two functions `createStore` and `useAuger`.
- Typescript first. Unlike older state management solutions, Auger State is designed to be type safe and fully lean on your editor's auto complete.

# Install

```bash
npm install --save auger-state
```

# Example

```tsx
import React from 'react';
import {useAuger, createStore} from 'auger-state';

// Create a type for our AppState
type State = {
  counter: {value: number};
  items: {id: string; name: string}[];
};

// Starting value of our state
const INITIAL_STATE: State = {
  counter: {value: 5},
  items: [
    {id: 'a', count: 6, name: 'PS5'},
    {id: 'b', count: 12, name: 'Xbox Series X'},
  ],
};

// Create our global store
const store = createStore(INITIAL_STATE);

export const Counter = React.memo(() => {
  // The useAuger callback returns a typed object that will
  // let us drill down and subscribe to part of our state
  const auger = useAuger(store);
  // This component will only update when the counter updates,
  //  not when any other part of the state updates
  const [counter, updateCounter] = auger.counter.$();

  return (
    <div>
      <button
        onClick={() =>
          // Increment the counter on click. Update callbacks pass an immer
          // draft so you can mutate the value directly
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

# API

## `createStore`

`createStore` takes a single POJO (plain old js object) and returns an `AugerStore` that holds the state. At this time, your state has to be comprised of plain objects, arrays, and primitives. It does not yet support Maps and Sets

### Definition

```ts
export declare function createStore<T>(state: T): AugerStore<T>;
```

### Example

```ts
import {createStore, useAuger} from 'auger-state';

const initialState = {
  todos: [
    {name: 'Buy Eggs', isDone: false},
    {name: 'Wear a Mask', isDone: false},
  ],
};

const store = createStore(initialState);

// ... inside of a React component

const auger = useAuger(store);
```

## `useAuger`

`useAuger` is the hook that is used to access data in the store. It returns an `Auger`. IRL an Auger is a large drill. The `Auger` returned by `useAuger` is a data structure with the same shape as your state and it lets you drill down into your state and subscribe to specific parts of it.

### Definition

```ts
export declare function useAuger<T>(store: AugerStore<T>): Auger<T>;
```

### Example

```tsx
import {createStore} from 'auger-state';
import React from 'react';

const initialState = {
  userPreferences: {tabSpacing: 4, favoriteFood: 'tofu'},
  counter: {value: 0},
};

const store = createStore(initialState);

const MyComponent = React.memo(() => {
  const auger = useAuger(store);

  // The $read() method returns the value
  // from the store and subscribes the component
  // to update when that value changes
  const tabSpacing = auger.userPreferences.tabSpacing.$read();

  // The $() method returns a tuple of the current value and an updater function.
  // This is a shorthand made to emulate the return value from useState.

  const [counter, updateCounter] = auger.counter.$();

  return (
    <div>
      <div>Tab Spacing: {tabSpacing}</div>
      <button onClick={() => updateCounter((counter) => counter.value++)}>
        {counter.value}
      </button>
      <button
        onClick={() =>
        // $update lets you update a part of the state.
          auger.userPreferences.$update(
            (userPreferences) => {userPreferences.favoriteFood = 'Pizza'),
            }
        }>
        Make Favorite Food Pizza
      </button>
    </div>
  );
});
```

## `AugerStore`

In most cases you will never have to interact with the `AugerStore` directly and will instead just pass it to the `useAuger` hook in your React component. The only time you will probably have to interact with `AugerStore` if you want to either use `AugerStore` with a UI library other than React or if you want to perform some side effects when ever the store changes (ex send something over the network or log when a certain part of the state changes).

The first method on `AugerStore` is `getState`. It does just what you think it would, return a readonly copy of the state at that point in time. Note that this copy of the state is immutable and won't update as the store updates. You can think of this as a snapshot in time.

The next method on `AugerStore` is `subscribe`. The purpose of `subscribe` is to notify observers if a certain part of the state has been updated. `subscribe` takes 2 parameters. The first is a path of property names that leads to the subset of your state. The second parameter is a callback that should be invoked when that subset of state changes. `subscribe` returns a single function that will unsubscribe the registered callback. To prevent memory leaks always make sure that you call unsubscribe when you are done subscribing to the store.

The final method on `AugerStore` is `update` which takes a single producer function. This is an immer `producer` function that passes a draft copy of your state that can be directly mutated. If you haven't seen immer before you can [check out the docs](https://immerjs.github.io/immer/docs/introduction).

### Definition

```ts
declare class AugerStore<T> {
  getState(): Readonly<T>;
  subscribe(path: SubKey[], callback: () => void): () => void;
  update(fn: (draft: Draft<T>) => void | T): void;
}
```

### Example

```ts
import {createStore} from 'auger-state';

const initialState = {
  userPreferences: {tabSpacing: 4, favoriteFood: 'tofu'},
  counter: {value: 0},
};

const store = createStore(initialState);

// If you want to subscribe to the entire state you can pass an empty array as
// the first parameter of subscribe.
const unsubLogging = store.subscribe([], () => console.log(store.getState()));

const unsubLocalStorage = store.subscribe(['userPreferences'], () =>
  localStorage.setItem(
    'userPreferences',
    JSON.stringify(store.getState().userPreferences),
  ),
);

// This will update the state and the entire state will be logged to the console
store.update((draft) => {
  draft.counter.value++;
});

// This will log the state to the console and save the userPreferences to localStorage
store.update((draft) => {
  draft.userPreferences.tabSpacing = 2;
});

// Unsubscribe from the store
unsubLogging();
unsubLocalStorage();
```

# Roadmap

1. Redux Dev Tools integration
2. Maps, Sets, and immerable objects

# License

MIT © [SawyerHood](https://github.com/SawyerHood)

# Credits

Auger icon made by [Icongeek26](https://www.flaticon.com/authors/icongeek26)
