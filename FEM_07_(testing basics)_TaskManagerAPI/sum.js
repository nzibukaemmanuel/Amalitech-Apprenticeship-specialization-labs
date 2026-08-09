// const sum=(a, b) => {
//     return a + b;
// };

// module.exports = sum;

function fetchPromise() {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve('Peanut butter');
        }, 1000);
    });
}

module.exports = fetchPromise;

