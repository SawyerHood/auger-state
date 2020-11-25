import * as React from 'react';
import {AugerStore, useAuger} from 'auger-state';
import faker from 'faker';

type Item = {id: string; count: number; name: string};

type State = {
  counter: number;
  items: Item[];
};

const state: State = {
  counter: 5,
  items: [
    {id: 'a', count: 6, name: 'PS5'},
    {id: 'b', count: 12, name: 'XBOX'},
  ],
};

const store = new AugerStore(state);

const ItemComp = React.memo((props: {id: number}) => {
  const state = useAuger(store);
  const [item, updateItem] = state.items[props.id].$();

  return (
    <tr>
      <td>{item.id}</td>
      <td>{item.name}</td>
      <td>{item.count}</td>
      <td>
        <button
          onClick={() =>
            updateItem((d) => {
              d.count++;
            })
          }>
          +
        </button>
      </td>
    </tr>
  );
});
ItemComp.displayName = 'Item';

const Items = React.memo(() => {
  const state = useAuger(store);
  const [items, updateItems] = state.items.$();
  const onClick = () => {
    updateItems((draft) => {
      for (let i = 0; i < 10000; i++) {
        draft.push({
          name: faker.commerce.productName(),
          count: faker.random.number(),
          id: faker.random.uuid(),
        });
      }
    });
  };
  return (
    <section>
      <header>
        <button onClick={onClick}>Add Items</button>
      </header>
      <table>
        <thead>
          <tr>
            <td>ID</td>
            <td>Item Name</td>
            <td>Count</td>
            <td>Add Item</td>
          </tr>
        </thead>
        <tbody>
          {items.map((_, i) => {
            return <ItemComp id={i} key={i} />;
          })}
        </tbody>
      </table>
    </section>
  );
});

const Body = React.memo(() => {
  return (
    <main>
      <Items />
    </main>
  );
});

const Counter = React.memo(() => {
  const state = useAuger(store);
  const [counter, updateCounter] = state.counter.$();

  return (
    <section>
      <aside
        style={{
          textAlign: 'center',
        }}>
        <h2>Counter</h2>
        <p>{counter}</p>
        <div style={{gap: 12, display: 'flex', justifyContent: 'center'}}>
          <button onClick={() => updateCounter((n) => n - 1)}>-</button>
          <button onClick={() => updateCounter((n) => n + 1)}>+</button>
        </div>
      </aside>
    </section>
  );
});

export default function App() {
  return (
    <>
      <Counter />
      <Body />
    </>
  );
}
