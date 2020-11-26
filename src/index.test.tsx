import {createStore, useAuger} from '.';
import {render, fireEvent, screen} from '@testing-library/react';
import * as React from 'react';

type TestState = {
  counter: {value: number};
  items: {id: number; name: string}[];
  users: {[id: string]: {name: string; age: number}};
};

function createTestStore() {
  const state: TestState = {
    counter: {value: 1},
    items: [{id: 1, name: 'hello'}],
    users: {['a']: {name: 'Sawyer', age: 26}},
  };
  return createStore(state);
}

describe('AugerStore', () => {
  const store = createTestStore();
  const rootCB = jest.fn();
  const counterCB = jest.fn();
  const valueCB = jest.fn();
  const usersCB = jest.fn();
  const sawyerNameCB = jest.fn();

  store.subscribe([], rootCB);
  const counterUnsub = store.subscribe(['counter'], counterCB);
  store.subscribe(['counter', 'value'], valueCB);
  store.subscribe(['users'], usersCB);
  store.subscribe(['users', 'a', 'name'], sawyerNameCB);

  it('notifies subscribers along a path', () => {
    store.update((state) => {
      state.counter.value++;
    });

    // notifies all of the subscribers down the path
    expect(rootCB).toBeCalled();
    expect(counterCB).toBeCalled();
    expect(valueCB).toBeCalled();

    // doesn't notify unrelated subscribers
    expect(usersCB).not.toBeCalled();
    expect(sawyerNameCB).not.toBeCalled();
  });

  it("doesn't call callbacks that have been unsubscribed", () => {
    counterUnsub();

    store.update((state) => {
      state.counter.value++;
    });

    expect(rootCB).toBeCalledTimes(2);
    expect(counterCB).toBeCalledTimes(1);
    expect(valueCB).toBeCalledTimes(2);
  });

  it('notifies items that are downstream of a set', () => {
    store.update((state) => {
      state.users = {a: {name: 'Sawyer2', age: 27}};
    });

    expect(sawyerNameCB).toBeCalled();
  });
});

describe('useAuger', () => {
  it('allows for reading and updating the store', () => {
    const store = createTestStore();
    const Component = () => {
      const auger = useAuger(store);
      const [user, updateUser] = auger.users['a'].$();
      return (
        <div
          data-testid="age"
          onClick={() =>
            updateUser((user) => {
              user.age++;
            })
          }>
          {user.age}
        </div>
      );
    };
    const handle = render(<Component />);
    expect(screen.getByTestId('age').textContent).toEqual('26');

    fireEvent.click(handle.getByTestId('age'));

    expect(screen.getByTestId('age').textContent).toEqual('27');
  });

  it('only updates a component if it is listening to part of the state that changed', () => {
    const store = createTestStore();
    const onAgeRender = jest.fn();
    const onCounterRender = jest.fn();

    const AgeComponent = React.memo(() => {
      const auger = useAuger(store);
      const [user, updateUser] = auger.users['a'].$();
      onAgeRender();
      return (
        <div
          data-testid="age"
          onClick={() =>
            updateUser((user) => {
              user.age++;
            })
          }>
          {user.age}
        </div>
      );
    });

    const CounterComponent = React.memo(() => {
      const auger = useAuger(store);
      const [counter, updateCounter] = auger.counter.$();
      onCounterRender();
      return (
        <div
          data-testid="counter"
          onClick={() =>
            updateCounter((counter) => {
              counter.value++;
            })
          }>
          {counter.value}
        </div>
      );
    });

    const Root = () => {
      return (
        <>
          <AgeComponent />
          <CounterComponent />
        </>
      );
    };

    render(<Root />);
    expect(screen.getByTestId('age').textContent).toBe('26');
    expect(screen.getByTestId('counter').textContent).toBe('1');
    expect(onAgeRender).toBeCalledTimes(1);
    expect(onCounterRender).toBeCalledTimes(1);

    fireEvent.click(screen.getByTestId('age'));
    expect(screen.getByTestId('age').textContent).toBe('27');
    expect(onAgeRender).toBeCalledTimes(2);
    expect(onCounterRender).toBeCalledTimes(1);

    fireEvent.click(screen.getByTestId('counter'));
    expect(screen.getByTestId('age').textContent).toBe('27');
    expect(screen.getByTestId('counter').textContent).toBe('2');
    expect(onAgeRender).toBeCalledTimes(2);
    expect(onCounterRender).toBeCalledTimes(2);
  });
});
