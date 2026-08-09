// const sum= require('./sum')
// test('adds 1 + 2 to equal 3', () => {
//     expect(sum(1, 2)).toBe(3);
// });

const fetchPromise = require('./sum');

test('the data is peanut butter', () => {
    return expect(fetchPromise()).resolves.toBe('Peanut butter');
});

test('the data is peanut butter', async () => {
    const data = await fetchPromise();
    expect(data).toBe('Peanut butter');
});