const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

type State = 'pending' | 'fulfilled' | 'rejected';

type Scheduler = (fn: () => void) => void;

function createPromisePolyfill(schedule: Scheduler) {
  const { isArray } = Array;

  interface Constructor<Type> {
    new (...args): Type;
  }

  // class PromiseRejectionEvent {
  //   bubbles: boolean;
  //   cancelable: boolean;
  //   cancelBubble: boolean;
  //   captures: boolean;
  //   currentTarget: any;
  //   promise: PromisePolyfill<any>;
  //   reason: any;
  //   srcElement: null;
  //   target: any;
  //   timeStamp: number;
  //   type: string;

  //   constructor(type: string, { promise, reason }) {
  //     this.bubbles = false;
  //     this.cancelable = true;
  //     this.cancelBubble = false;
  //     this.captures = false;
  //     this.currentTarget = window;
  //     this.promise = promise;
  //     this.reason = reason;
  //     this.srcElement = null;
  //     this.target = window;
  //     this.timeStamp = Date.now();
  //     this.type = type;
  //   }

  //   toString() {
  //     return this.reason.toString();
  //   }
  // }

  // "global" config for use of debug tracing
  let isUsingDebugTrace = false;

  /**
   * @class PromisePolyfill
   *
   * @classdesc
   * polyfill the standard ES2015 Promise global based on the schedule passed
   */
  class PromisePolyfill<Value> {
    _handlers: any[];
    _handlerName?: string;
    _hasHandledRejection: boolean;
    _parent: PromisePolyfill<any> | null;
    _previous: PromisePolyfill<any> | null;
    _stack?: string[];
    _state: State;
    _value: any;

    constructor(executor: Function) {
      if (typeof executor !== 'function') {
        throw new TypeError(`Promise resolver ${executor} is not a function`);
      }

      if (isUsingDebugTrace) {
        // handler name used in debug tracing for sibling promises in chain
        this._handlerName = null;
        // captured error stack used to fake the full promise error chain
        this._stack = getNormalizedStack();
      }

      // store success & failure handlers
      this._handlers = [];

      // has any of the handlers passed handled the rejection
      this._hasHandledRejection = false;

      // the parent promise (in case of nested promises)
      this._parent = null;

      // the previous promise in the sibling chain
      this._previous = null;

      // store state which can be PENDING, FULFILLED or REJECTED
      this._state = PENDING;

      // store value once FULFILLED or REJECTED
      this._value = null;

      // execute constructor callback synchronously, as all resolve/rejects
      // will be handled by the scheduler
      this._execute(executor);
    }

    /**
     * @static
     * @var _status
     *
     * @description
     * the available statuses for all promises
     *
     * @property {'fulfilled'} FULFILLED
     * @property {'pending'} PENDING
     * @property {'rejected'} REJECTED
     */
    static _status = {
      FULFILLED,
      PENDING,
      REJECTED,
    };

    /**
     * @static
     * @function all
     *
     * @description
     * Process all the promises in the array passed, and return their resolved values. If one
     * errors, then immediately return the error.
     *
     * @param {Array<Promise>} promises the promises to process
     * @returns {Array<any>|Error} the result of the promises, or an error if one fails
     */
    static all(promises: PromisePolyfill<any>[]) {
      if (!isArray(promises)) {
        return PromisePolyfill.reject(
          TypeError('Promise.all accepts an array.'),
        );
      }

      const { length } = promises;

      if (!length) {
        return PromisePolyfill.resolve([]);
      }

      return new PromisePolyfill((resolve, reject) => {
        const results = [];

        let hasCompleted = false;
        let remaining = length;

        function resolveIndex(index, value) {
          try {
            if (value) {
              if (value instanceof PromisePolyfill) {
                const then = value.then;

                then.call(
                  value,
                  function (_value) {
                    resolveIndex(index, _value);
                  },
                  reject,
                );

                return;
              }
            }

            results[index] = value;

            if (--remaining === 0 && !hasCompleted) {
              hasCompleted = true;

              resolve(results);
            }
          } catch (error) {
            if (!hasCompleted) {
              hasCompleted = true;

              reject(error);
            }
          }
        }

        for (let index = 0; index < length; index++) {
          resolveIndex(index, promises[index]);
        }
      });
    }

    /**
     * @static
     * @function race
     *
     * @description
     * Process all the promises in the array passed, returning the result
     * of the first one to resolve.
     *
     * @param {Array<Promise>} promises the promises to process
     * @returns {any} the result of the first promise to resolve
     */
    static race(promises: PromisePolyfill<any>[]) {
      if (!isArray(promises)) {
        return PromisePolyfill.reject(
          TypeError('Promise.race accepts an array.'),
        );
      }

      const { length } = promises;

      if (!length) {
        return PromisePolyfill.resolve([]);
      }

      return new PromisePolyfill((resolve, reject) => {
        let hasCompleted = false;

        function resolveIndex(index, value) {
          try {
            if (value) {
              const type = typeof value;

              if (value instanceof PromisePolyfill) {
                const then = value.then;

                then.call(
                  value,
                  function (_value) {
                    resolveIndex(index, _value);
                  },
                  reject,
                );

                return;
              }
            }

            if (!hasCompleted) {
              hasCompleted = true;

              resolve(value);
            }
          } catch (error) {
            if (!hasCompleted) {
              hasCompleted = true;

              reject(error);
            }
          }
        }

        for (let index = 0; index < length; index++) {
          resolveIndex(index, promises[index]);
        }
      });
    }

    /**
     * @static
     * @function reject
     *
     * @description
     * immediately return a rejected promise with the reason passed
     *
     * @param {Error} reason the rejection reason
     * @returns {Promise} the rejected promise
     */
    static reject(reason?: any) {
      return new PromisePolyfill((resolve, reject) => reject(reason));
    }

    /**
     * @static
     * @function resolve
     *
     * @description
     * immediately return a resolves promise with the value passed
     *
     * @param {any} value the resolved value
     * @returns {Promise} the resolved promise
     */
    static resolve(value?: any) {
      return new PromisePolyfill((resolve) => resolve(value));
    }

    /**
     * @static
     * @function useDebugTrace
     *
     * @description
     * set the global use of debug tracing
     *
     * @NOTE
     * this is _expensive_, so it should not be used in production unless
     * debugging a specific issue
     *
     * @param [shouldUseDebugTrace=true] should the debug trace be used
     */
    static useDebugTrace(shouldUseDebugTrace: boolean = true) {
      isUsingDebugTrace = shouldUseDebugTrace;
    }

    /**
     * @private
     * @instance
     * @function _execute
     *
     * @description
     * execute the callback to either resolve or reject the promise
     *
     * @param {function} executor the method to execute the resolve / reject callback
     */
    _execute(executor) {
      let done = false;

      try {
        executor(
          (value) => {
            if (done) {
              return;
            }

            done = true;

            this._resolve(value);
          },
          (reason) => {
            if (done) {
              return;
            }

            done = true;

            this._reject(reason);
          },
        );
      } catch (ex) {
        if (done) {
          return;
        }

        done = true;

        this._reject(ex);
      }
    }

    /**
     * @private
     * @instance
     * @function _handle
     *
     * @description
     * schedule the handling of a task, so than when called it will resolve or
     * reject the promise
     *
     * @param {Array<function>} handler the method to handle the scheduled tasks
     */
    _handle(handler) {
      if (this._state === PENDING) {
        // queue for when we eventually resolve
        this._handlers.push(handler);

        return;
      }

      // schedule the tasks
      schedule(() => {
        const { _state: state, _value: value } = this;
        const [onFulfilled, onRejected, thenResolve, thenReject] = handler;

        let callback;

        if (state === FULFILLED && typeof onFulfilled === 'function') {
          callback = onFulfilled;
        } else if (state === REJECTED && typeof onRejected === 'function') {
          callback = onRejected;
        }

        if (!callback) {
          if (state === FULFILLED) {
            thenResolve(value);
          } else {
            thenReject(value);
          }

          return;
        }

        if (isUsingDebugTrace) {
          this._handlerName = callback.name;

          const name = this._previous && this._previous._handlerName;

          if (name) {
            const thrownAt = this._stack[0];

            this._stack[0] = thrownAt.replace('(anonymous)', name);
          }
        }

        // this is needed to catch exceptions from the callback
        try {
          const result = callback(value);

          if (result instanceof PromisePolyfill) {
            let parent: PromisePolyfill<any> = this;

            while (parent._previous) {
              parent = parent._previous;
            }

            result._parent = parent;

            let previous = result;

            while (previous._previous) {
              previous._previous._parent = parent;

              previous = previous._previous;
            }
          }

          thenResolve(result);
        } catch (error) {
          if (isUsingDebugTrace) {
            error.stack = getDebugTracingStack(error, this);
          }

          thenReject(error);
        }
      });
    }

    /**
     * @private
     * @instance
     * @function _reject
     *
     * @description
     * reject the promise based on the reason provided
     *
     * @param {Error} reason the rejection reason
     */
    _reject(reason) {
      schedule(() => {
        this._state = REJECTED;
        this._value = reason;

        const handlers = this._handlers;

        if (handlers.length) {
          for (
            let index = 0, length = handlers.length;
            index < length;
            index++
          ) {
            this._handle(handlers[index]);
          }

          handlers.length = 0;
        } else {
          // const event = new PromiseRejectionEvent('unhandledrejection', {
          //   // @ts-ignore
          //   promise: this,
          //   reason,
          // });

          /**
           * @NOTE REMOVE THIS
           *
           * I had to do this because in the web, PromiseRejectionEvent is a real event, and
           * TypeScript does not allow extending native Event class. So, this is just a fake.
           */
          const event = new Event('unhandledrejection');

          let origin: PromisePolyfill<any> | null = this;

          while (origin._previous) {
            origin = origin._previous;
          }

          if (!origin._hasHandledRejection) {
            window.dispatchEvent(event);

            origin._hasHandledRejection = true;
          }
        }
      });
    }

    /**
     * @private
     * @instance
     * @function _resolve
     *
     * @description
     * resolve the promise based on the result provided
     *
     * @param {any} result the reason of the resolved promise
     */
    _resolve(result) {
      schedule(() => {
        try {
          // don't allow a promise to return itself
          if (result === this) {
            this._reject(new TypeError());
            return;
          }

          const resultType = typeof result;

          let then = null;

          if (result && result instanceof PromisePolyfill) {
            then = result.then;
          }

          if (then) {
            this._execute(then.bind(result));

            return;
          }

          this._state = FULFILLED;
          this._value = result;

          // finalize
          const handlers = this._handlers;

          for (
            let index = 0, length = handlers.length;
            index < length;
            index++
          ) {
            this._handle(handlers[index]);
          }

          handlers.length = 0;
        } catch (error) {
          this._reject(error);
        }
      });
    }

    /**
     * @instance
     * @function catch
     *
     * @description
     * handle the rejected promise based on the callback passed and then continue the promise chain
     * based on the rejection reason
     *
     * @param {function} onRejected callback to call when the promise is rejected
     * @returns {Promise} the rejected promise
     */
    catch(onRejected) {
      return this.then(null, onRejected);
    }

    /**
     * @instance
     * @function finally
     *
     * @description
     * call the callback passed and then continue the promise chain based on the previous
     * resolve / reject value
     *
     * @param {function} onFinally callback to call when the finally stage is reached in the promise
     * @returns {Promise} the continued promise
     */
    finally(onFinally) {
      return this.then(
        (value) => PromisePolyfill.resolve(onFinally()).then(() => value),
        (reason) =>
          PromisePolyfill.resolve(onFinally()).then(() =>
            PromisePolyfill.reject(reason),
          ),
      );
    }

    /**
     * @instance
     * @function then
     *
     * @description
     * call the appropriate callback passed based on whether the promise was resolved
     * or rejected and then continue the promise chain based on the resulting value
     *
     * @param {function} onFulfilled callback to call when the promise is resolved
     * @param {function} onRejected callback to call when the promise is rejected
     * @returns {Promise} the resolved or rejected promise
     */
    then(onFulfilled?: Function | void, onRejected?: Function | void) {
      if (typeof onFulfilled !== 'function') {
        onFulfilled = undefined;
      }

      if (typeof onRejected !== 'function') {
        onRejected = undefined;
      }

      const next = new (this.constructor as Constructor<PromisePolyfill<any>>)(
        (thenResolve, thenReject) => {
          this._handle([onFulfilled, onRejected, thenResolve, thenReject]);
        },
      );

      next._previous = this;

      return next;
    }
  }

  const INTERNAL_STACK_LAYER = new RegExp(`at(.*)${PromisePolyfill.name}`);
  const NORMALIZE_STACK_LAYER = /at (.*)/;
  const ANONYMOUS_STACK_LAYER = /at http:\/\//;
  const MULTISPACE = /\s+$/g;
  const LOCATION = /^\s*at\s*/;

  const NO_STACK_TRACE = '(No stack trace)';
  const SYNTAX_ERROR = 'SyntaxError';
  const DEBUG_TRACING_HEADER = 'From previous event:';

  /**
   * @function getNormalizedStackLayer
   *
   * @description
   * normalize the stack layer, which right now just means coalescing the
   * caller name to anonymous
   *
   * @param layer the layer to normalize
   * @returns the normalized layer
   */
  function getNormalizedStackLayer(layer: string): string {
    if (ANONYMOUS_STACK_LAYER.test(layer)) {
      return layer.replace(NORMALIZE_STACK_LAYER, (_: any, value: string) => {
        return `at (anonymous) (${value})`;
      });
    }

    return layer;
  }

  /**
   * @function getStackArray
   *
   * @description
   * get the stack as a normalized array of layers
   *
   * @param error the error to get the stack array from
   * @returns the stack array
   */
  function getStackArray(error: Error): string[] {
    const stack = error.stack.replace(MULTISPACE, '').split('\n');

    let index = 0;

    for (; index < stack.length; ++index) {
      const line = stack[index];

      if (NO_STACK_TRACE === line || LOCATION.test(line)) {
        break;
      }
    }

    return index > 0 && error.name !== SYNTAX_ERROR
      ? stack.slice(index).map(getNormalizedStackLayer)
      : stack.map(getNormalizedStackLayer);
  }

  /**
   * @function cleanStack
   *
   * @description
   * remove lines in the stack trace that do not directly relate to code
   *
   * @param stack the stack to clean
   * @returns the cleaned stack
   */
  function cleanStack(stack: string[]): string[] {
    const cleanStack = [];

    const { length } = stack;

    for (let index = 0; index < length; ++index) {
      const line = stack[index];

      if (LOCATION.test(line)) {
        cleanStack.push(line);
      }
    }

    return cleanStack;
  }

  type NormalizedError = {
    message: string;
    stack: string[];
  };

  /**
   * @function getNormalizedError
   *
   * @description
   * normalize the error to have a clean stack array and message
   *
   * @param error the error to normalize
   * @returns the normalized error
   */
  function getNormalizedError(error: Error): NormalizedError {
    const stack = getStackArray(error);

    return {
      message: error.message,
      stack: error.name === SYNTAX_ERROR ? stack : cleanStack(stack),
    };
  }

  /**
   * @function getNormalizedStack
   *
   * @description
   * get the normalized stack to be used later in debug tracing
   *
   * @returns the normalized stack
   */
  function getNormalizedStack(): string[] {
    try {
      throw new Error();
    } catch (error) {
      const { stack } = getNormalizedError(error);

      for (let index = 2; index < stack.length; ++index) {
        if (!INTERNAL_STACK_LAYER.test(stack[index])) {
          return stack.slice(index);
        }
      }

      return [];
    }
  }

  /**
   * @function getDebugTracingStack
   *
   * @description
   * get the full debug tracing stack for the error
   *
   * @param error the error to get the debug tracing stack for
   * @param promise the promise instigating the error
   * @returns the debug tracing stack
   */
  function getDebugTracingStack(error: Error, promise: PromisePolyfill<any>) {
    const newStack = [];

    // main stack message
    newStack.push(error.stack.split('\n')[0]);

    // main stack location
    newStack.push(getNormalizedError(error).stack[0]);

    // ancestor stacks
    const ancestry = promise._previous || promise._parent;
    const addedStacks = [promise._stack, ancestry._stack];

    let previous = ancestry._previous || ancestry._parent;

    while (previous) {
      addedStacks.push(previous._stack);

      previous = previous._previous || previous._parent;
    }

    const topLevelStack = addedStacks.pop();

    const { length } = addedStacks;

    for (let index = 0; index < length; ++index) {
      const stack = cleanStack(addedStacks[index]);

      for (let index = 0; index < stack.length; index++) {
        if (!INTERNAL_STACK_LAYER.test(stack[index])) {
          newStack.push(DEBUG_TRACING_HEADER, stack[index]);

          break;
        }
      }
    }

    // top-level stack
    newStack.push(DEBUG_TRACING_HEADER, ...topLevelStack);

    return newStack.join('\n');
  }

  return PromisePolyfill;
}

export default createPromisePolyfill((fn) => queueMicrotask(fn));
