import P from './Promise';

setTimeout(() => console.log('setTimeout end'), 0, true);

/* ----------- UNHANDLED REJECTION ----------- */

// window.addEventListener('unhandledrejection', (...args) => {
//   console.log('unhandled rejection fired', args);
// });

// const a = new P(function (a, b) {
//   setTimeout(function () {
//     b(12);
//   },         1000);
// });

// a.then(function (a) {}).catch(function (a) {});

// a.then(function (a) {});

/* ----------- CUSTOM ERROR HANDLING ----------- */

P.useDebugTrace();

P.resolve('top-level resolve').then(function outer() {
  return P.resolve('outer resolve').then(function () {
    return P.resolve('inner resolve')
      .then(function blah() {
        return 123;
      })
      .then(function blarg() {
        return 234;
      })
      .then(function evenMoreInner() {
        // @ts-ignore
        a.b.c.d();
      })
      .catch(function catcher(e) {
        console.error(e.stack);
      });
  });
});

/* ----------- UNCALLABLE THEN HANDLERS ----------- */

// P.resolve()
//   // @ts-ignore
//   .then('foo')
//   .then(() => {
//     console.log('bar');
//   });

// Promise.resolve().then(function outer() {
//   return Promise.resolve().then(function () {
//     return Promise.resolve('needs parent')
//       .then(function blah() {
//         return 123;
//       })
//       .then(function blarg() {
//         return 234;
//       })
//       .then(function evenMoreInner() {
//         // @ts-ignore
//         a.b.c.d();
//       })
//       .catch(function catcher(e) {
//         console.error(e.stack);
//       });
//   });
// });

/* ----------- ORDER OF OPERATIONS ----------- */

// P.resolve()
//   .then(function () {
//     console.log('promise1');
//   })
//   .then(function () {
//     console.log('promise2');

//     P.resolve().then(function () {
//       console.log('promise3');
//     });

//     setTimeout(
//       () => {
//         P.resolve().then(() => console.warn('promise5'));
//       },
//       100,
//       true,
//     );

//     new P((resolve) => {
//       setTimeout(
//         () => {
//           console.warn('promise6');
//           resolve();
//         },
//         150,
//         true,
//       );
//     });
//   })
//   .then(function () {
//     console.log('promise4');
//   });

/* ----------- FAILURES ----------- */

// P.reject(new Error('fail with then handler')).then(null, (_error) =>
//   console.error(_error),
// );

// P.reject(new Error('fail with catch handler')).catch((_error) =>
//   console.error(_error),
// );

// P.reject(new Error('fail uncaught'));

/* ----------- STATICS ----------- */

// P.all([
//   new P((resolve) => setTimeout(() => resolve('slow response'), 1000)),
//   // new P((resolve, reject) => setTimeout(() => reject(new Error('boom')), 10)),
//   P.resolve('fast response'),
// ])
//   .then(function (results) {
//     console.info('promise all', results);
//   })
//   .catch((_error) => console.error('promise all', _error));

// P.race([
//   new P((resolve) => setTimeout(() => resolve('slow response'), 10000)),
//   new P((resolve) => setTimeout(() => resolve('medium response'), 5000)),
//   // new P((resolve, reject) => setTimeout(() => reject(new Error('boom')), 1000)),
//   new P((resolve) => setTimeout(() => resolve('fast response'), 2500)),
// ])
//   .then(function (results) {
//     console.warn('promise race', results);
//   })
//   .catch((_error) => console.error('promise race', _error));

console.log('Sync end');
