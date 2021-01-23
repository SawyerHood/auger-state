import * as React from 'react';
import ReactDOM from 'react-dom';
import {
  Draft,
  enableMapSet,
  produceWithPatches,
  enablePatches,
  setAutoFreeze,
} from 'immer';
enablePatches();
enableMapSet();
setAutoFreeze(false);

const {useRef, useEffect, useState} = React;

const EMPTY_OBJECT = {};
const EMPTY_FN = () => {};

// This function is a function that will be triggered when a node in the
// subscriber tree updates
type Subscription = () => void;

/*
SubscriberNode is the type that makes the AugerStore work. Most app states
end up being large, nested JS objects, which can be thought of as trees.

Imagine that we have an application state that looks something like this:

```
type State = {
  counter: {value: number};
  user: {name: string; age: string};
};
```

This could be visualized as a tree like so:

state
├── counter
│   └── value
└── user
    ├── name
    └── age

In this example, each line is a different subscriber node with a set of all
of callbacks to be called when the node updates and a list of all children.

AugerStore uses immer to update the state which means that we know the actual
subset of state was changed and we only have to subscribers listening to those
subtrees.

Imagine that I update the state like so:

```
store.update(state => {
  state.user.age++
})
```

In this case we only have to notify subscribers that were listening above the path
that was updated. In the figure below nodes that had there subscription triggered are
denoted with an '*'.

*state
├── counter
│   └── value
└── *user
    ├── name
    └── *age

Note that anything listening to the root or user have to be notified because they will
end up with new object references after this update. All of the parts of the state that
aren't updated (ex the user name and the counter) won't have their subscribers notified!

One thing to note, if you set a property that has children ALL of the children have to
be notified recursively. Ex if we do this:

```
store.update(state => {
  state.user = {name: 'Sawyer', age: 26}
})
```

We now have to update all listeners down stream of user:

*state
├── counter
│   └── value
└── *user
    ├── *name
    └── *age

*/
type SubscriberNode = {
  subs: Set<Subscription>;
  children: Map<SubKey, SubscriberNode>;
};

function createSubNode(): SubscriberNode {
  return {subs: new Set(), children: new Map()};
}

// This is the class that manages all of the subscriptions to different nodes,
// is responsible for keeping a copy of the current state, updates the state,
// and most importantly notifies subscribers when the state updates.
class AugerStore<T> {
  private root: SubscriberNode = createSubNode();
  private state: T;

  constructor(state: T) {
    this.state = state;
  }

  getState(): Readonly<T> {
    return this.state;
  }

  // Takes a path to the property in the state and a callback to be triggered
  // when that part of the state changes. This function walks down the path
  // and creates SubscriberNodes as needed from the root until we are at the
  // terminal of the path.
  subscribe(path: SubKey[], sub: Subscription): () => void {
    let node = this.root;
    for (const key of path) {
      if (node.children.has(key)) {
        node = node.children.get(key)!;
      } else {
        const child = createSubNode();
        node.children.set(key, child);
        node = child;
      }
    }
    node.subs.add(sub);

    // TODO Sawyer: This should do some garbage collection of abandoned subscriber
    // nodes
    return () => {
      node.subs.delete(sub);
    };
  }

  // This updates the state and notifies the subscribers of the changed
  // properties. It takes an updater function that takes in an immer draft
  // of the state. This function that reads the JSON patches outputted by
  // immer to notify subscribers for the properties changed.
  update(fn: (draft: Draft<T>) => void | T) {
    const [nextState, patches] = produceWithPatches(this.state, fn);
    this.state = nextState as T;

    // TODO Sawyer: I should make sure that this works with React Native.
    // I need to update this so it uses the ReactNative version of batchedUpdates.
    ReactDOM.unstable_batchedUpdates(() => {
      for (const patch of patches) {
        this.notifyPath(patch.path);
      }
    });
  }

  auger(onRead: (path: SubKey[]) => void = EMPTY_FN): Auger<T> {
    return createAuger(this, [], onRead);
  }

  // Recursively notify all children of a SubscriberNode
  // We might want to clear all of these subscriptions as we go down
  // in the future, but the hooks takes care of this for us, if you
  // call subscribe manually you are responsible for removing the
  // sub if the node doesn't exist
  private notifyAllChildren(node: SubscriberNode) {
    node.subs.forEach((s) => s());
    for (const child of node.children.values()) {
      this.notifyAllChildren(child);
    }
  }

  // This notifies all of the nodes along the path to the terminal property
  // and from there it notifies all of the children in a recursive manner.
  private notifyPath(path: SubKey[]) {
    let node = this.root;
    node.subs.forEach((s) => s());

    for (let i = 0; i < path.length; i++) {
      const key = String(path[i]);
      const child = node.children.get(key);
      if (!child) {
        break;
      }
      node = child;
      if (i === path.length - 1) {
        this.notifyAllChildren(node);
      } else {
        node.subs.forEach((s) => s());
      }
    }
  }
}

// All of the valid properties keys of an object
type SubKey = string | number | symbol;

// This is a callback that updates the state
type UpdateFn<T> = (draft: Draft<T>) => Draft<T> | void;

// This is the special interface of an Auger.
type AugerHandles<T> = {
  // Returns the current value at a property.
  // When called from a React component this also sets up a subscription
  // To the store.
  $read(): T;
  // This updates this property in the store.
  $update(updater: UpdateFn<T>): void;
  // This both returns the current value of the property
  // and returns a function that can be called to update
  // the property. This is made to emulate the return shape
  // of the `useState` hook.
  $(): [T, (updater: UpdateFn<T>) => void];
} & (FilterPrimitives<T, never> extends Map<infer K, infer V>
  ? {get: (key: K) => Auger<V | undefined | NullPart<T>>}
  : {});

// This helper type returns if the type can be null | undefined
// and returns never if it can't be either
type NullPart<T> = Exclude<T, NonNullable<T>>;
type FilterPrimitives<T, U> = T extends
  | string
  | number
  | null
  | undefined
  | symbol
  | boolean
  ? U
  : T;

// In the real world an Auger is a large drill that is used for drilling holes
// in the ground. In auger-state an Auger is an object that lets you drill down
// into your state and only subscribe to parts of it. In React you will interface
// with this via the useAuger hook.
//
// This type is a little complex. It checks if the node is a primitive and if so
// sets the type for that node as the AugerHandles. If the type is an object or array
// we iterate over all of the values and make sure that are mapped to Augers as well.
// An important thing to note, if the current node can be nullable, we have to make
// sure that all of the children's return types can be nullable as well.
//
// TODO make sure that we filter out array and map methods
export type Auger<T> = AugerImpl<T, T>;

type AugerImpl<T, U> = (FilterPrimitives<T, U> extends (infer A)[]
  ? Auger<A | NullPart<U>>[]
  : FilterRes<T, U> extends never
  ? {}
  : FilterRes<T, U>) &
  AugerHandles<T>;

type FilterRes<T, U> = FilterPrimitives<
  Required<{[P in keyof T]: Auger<T[P] | NullPart<U>>}>,
  never
>;

function createAuger<T>(
  store: AugerStore<T>,
  path: SubKey[],
  onRead: (p: SubKey[]) => void,
): Auger<T> {
  const result = new Proxy(EMPTY_OBJECT, {
    get(_, key) {
      if (
        key === '$' ||
        key === '$read' ||
        key === '$update' ||
        key === 'get'
      ) {
        return createAugerHandles(store, path, onRead)[key];
      }
      return createAuger(store, [...path, key], onRead);
    },
  });

  return result as any;
}

// This builds up the `$`, `$read`, and `$update` function for a given node.
function createAugerHandles<T>(
  store: AugerStore<any>,
  path: SubKey[],
  onRead: (p: SubKey[]) => void,
): AugerHandles<T> {
  const $read = () => {
    onRead(path);
    let value = store.getState();
    for (const key of path) {
      if (value instanceof Map) {
        value = value.get(key);
      } else if (value == null) {
        return value;
      } else {
        value = value[key as string];
      }
    }

    return value;
  };

  const $update = (fn: UpdateFn<T>) => {
    store.update((draft) => {
      let subNode = draft;
      let parent = null;
      let lastProp = null;
      for (const prop of path) {
        parent = subNode;
        lastProp = prop;
        subNode = subNode[prop];
      }
      const newNode = fn(subNode);
      if (newNode !== undefined) {
        if (parent && lastProp != null) {
          if (parent instanceof Map) {
            parent.set(lastProp, newNode);
          } else {
            parent[lastProp] = newNode;
          }
        } else {
          return newNode;
        }
      }
      return undefined;
    });
  };

  const $ = (): [T, typeof $update] => {
    return [$read() as any, $update];
  };

  return {
    $read,
    $update,
    $,
    get: (key: any) => {
      return createAuger(store, [...path, key], onRead);
    },
  } as any;
}

// This is the main public interface that React users interface with.
// The useAuger hook creates an Auger for the given store. The Auger
// returned from this hook can be used to subscribe to parts of the
// app state. Ex:
//
// const [counter, updateCounter] = auger.counter.$();
//
export function useAuger<T>(store: AugerStore<T>): Auger<T> {
  const subs = useRef<SubKey[][]>([]);
  const [, updateCounter] = useState(0);
  const rerender = () => {
    updateCounter((i) => i + 1);
  };

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    for (const path of subs.current) {
      unsubs.push(store.subscribe(path, rerender));
    }
    subs.current = [];
    return () => {
      for (const release of unsubs) {
        release();
      }
    };
  });

  return createAuger(store, [], (p) => subs.current.push(p)) as any;
}

export function createStore<T>(state: T): AugerStore<T> {
  return new AugerStore(state);
}
