import * as React from 'react';
import ReactDOM from 'react-dom';
import { produceWithPatches, Draft, enablePatches, setAutoFreeze } from 'immer';
enablePatches();
setAutoFreeze(false);

const { useRef, useEffect, useContext, useState, useCallback } = React;

type Subscription = () => void;

type SubsciberNode = {
  subs: Set<Subscription>;
  children: Map<SubKey, SubsciberNode>;
};

function createSubNode(): SubsciberNode {
  return { subs: new Set(), children: new Map() };
}

export class AugerStore<T> {
  root: SubsciberNode = createSubNode();
  state: T;

  constructor(state: T) {
    this.state = state;
  }

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
    return () => {
      node.subs.delete(sub);
    };
  }

  update(fn: (draft: Draft<T>) => void | T) {
    const [nextState, patches] = produceWithPatches(this.state, fn);
    this.state = nextState as T;
    ReactDOM.unstable_batchedUpdates(() => {
      for (const patch of patches) {
        this.notifyPath(patch.path);
      }
    });
  }

  private notifyAllChildren(node: SubsciberNode) {
    node.subs.forEach((s) => s());
    for (const child of node.children.values()) {
      this.notifyAllChildren(child);
    }
  }

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

type SubKey = string | number | symbol;

type UpdateFn<T> = (draft: Draft<T>) => Draft<T> | void;

interface AugerHandles<T> {
  $read(): T;
  $update(updater: UpdateFn<T>): void;
  $(): [T, (updater: UpdateFn<T>) => void];
}

type NullPart<T> = T extends undefined | null
  ? T
  : T extends undefined
  ? T
  : T extends null
  ? T
  : never;

type Auger<T> = (T extends number
  ? {}
  : T extends string
  ? {}
  : T extends symbol
  ? {}
  : T extends boolean
  ? {}
  : Required<
      {
        [P in keyof T]: Auger<T[P] | NullPart<T[P] | NullPart<T>>>;
      }
    >) &
  AugerHandles<T>;

function createAugerHandles<T>(
  state: T,
  path: SubKey[],
  onSub: (p: SubKey[]) => void,
  store: AugerStore<any>
): AugerHandles<T> {
  const $read = () => {
    onSub(path);
    return state;
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
          parent[lastProp] = newNode;
        } else {
          return newNode;
        }
      }
      return undefined;
    });
  };

  const $ = (): [T, typeof $update] => {
    return [$read(), $update];
  };

  return {
    $read,
    $update,
    $
  };
}

function createAuger<T extends any>(
  state: T,
  path: SubKey[],
  onSub: (p: SubKey[]) => void,
  store: AugerStore<any>
): Auger<T> {
  if (typeof state !== 'object' || state == null) {
    return createAugerHandles(state, path, onSub, store) as any;
  }
  return new Proxy(state as any, {
    get(target, key) {
      if (key === '$' || key === '$read' || key === '$update') {
        return createAugerHandles(target, path, onSub, store)[key];
      }
      return createAuger(target[key], [...path, key], onSub, store);
    }
  }) as any;
}

export const AugerStoreContext = React.createContext<AugerStore<any> | null>(
  null
);

export function useAuger<T>(): Auger<T> {
  const store = useContext(AugerStoreContext)!;
  const subs = useRef<SubKey[][]>([]);
  const [, updateCounter] = useState(0);
  const rerender = useCallback(() => {
    updateCounter((i) => i + 1);
  }, [updateCounter]);
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
  return createAuger(
    store.state as T,
    [],
    (p) => subs.current.push(p),
    store
  ) as any;
}
