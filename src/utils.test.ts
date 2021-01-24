import {visitPromises} from './utils';

describe('visitPromises', () => {
  it('finds promises in an object', () => {
    const fn = () => {};
    const promises = [];
    visitPromises(
      {
        key: [new Promise(fn)],
        key2: new Promise(fn),
        key3: 0,
        key4: new Map<any, any>([
          [0, new Promise(fn)],
          [1, new Set([new Promise(fn), 4])],
        ]),
      },
      (p) => promises.push(p),
    );

    expect(promises.length).toBe(4);
  });
});
