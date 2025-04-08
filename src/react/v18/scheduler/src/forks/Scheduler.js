/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* eslint-disable no-var */

import {
  enableSchedulerDebugging,
  enableProfiling,
  enableIsInputPending,
  enableIsInputPendingContinuous,
  frameYieldMs,
  continuousYieldMs,
  maxYieldMs,
} from "../SchedulerFeatureFlags";

import { push, pop, peek } from "../SchedulerMinHeap";

// TODO: Use symbols?
import {
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  LowPriority,
  IdlePriority,
} from "../SchedulerPriorities";
import {
  markTaskRun,
  markTaskYield,
  markTaskCompleted,
  markTaskCanceled,
  markTaskErrored,
  markSchedulerSuspended,
  markSchedulerUnsuspended,
  markTaskStart,
  stopLoggingProfilingEvents,
  startLoggingProfilingEvents,
} from "../SchedulerProfiling";
import {
  unstable_setDisableYieldValue,
  unstable_yieldValue,
} from "./SchedulerMock";
let getCurrentTime;
const hasPerformanceNow =
  typeof performance === "object" && typeof performance.now === "function";

if (hasPerformanceNow) {
  const localPerformance = performance;
  getCurrentTime = () => localPerformance.now();
} else {
  const localDate = Date;
  const initialTime = localDate.now();
  getCurrentTime = () => localDate.now() - initialTime;
}

// Max 31 bit integer. The max integer size in V8 for 32-bit systems.
// Math.pow(2, 30) - 1
// 0b111111111111111111111111111111
var maxSigned31BitInt = 1073741823;

// Times out immediately
var IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out
var USER_BLOCKING_PRIORITY_TIMEOUT = 250;
var NORMAL_PRIORITY_TIMEOUT = 5000;
var LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
var IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;

// Tasks are stored on a min heap
var taskQueue = [];
var timerQueue = [];

// Incrementing id counter. Used to maintain insertion order.
var taskIdCounter = 1;

// Pausing the scheduler is useful for debugging.
var isSchedulerPaused = false;

var currentTask = null;
var currentPriorityLevel = NormalPriority;

// This is set while performing work, to prevent re-entrance.
var isPerformingWork = false;

var isHostCallbackScheduled = false;
var isHostTimeoutScheduled = false;

// Capture local references to native APIs, in case a polyfill overrides them.
const localSetTimeout = typeof setTimeout === "function" ? setTimeout : null;
const localClearTimeout =
  typeof clearTimeout === "function" ? clearTimeout : null;
const localSetImmediate =
  typeof setImmediate !== "undefined" ? setImmediate : null; // IE and Node.js + jsdom

const isInputPending =
  typeof navigator !== "undefined" &&
  navigator.scheduling !== undefined &&
  navigator.scheduling.isInputPending !== undefined
    ? navigator.scheduling.isInputPending.bind(navigator.scheduling)
    : null;

const continuousOptions = { includeContinuous: enableIsInputPendingContinuous };

function advanceTimers(currentTime) {
  // Check for tasks that are no longer delayed and add them to the queue.
  let timer = peek(timerQueue);
  while (timer !== null) {
    if (timer.callback === null) {
      // Timer was cancelled.
      pop(timerQueue);
    } else if (timer.startTime <= currentTime) {
      // Timer fired. Transfer to the task queue.
      pop(timerQueue);
      timer.sortIndex = timer.expirationTime;
      push(taskQueue, timer);
      if (enableProfiling) {
        markTaskStart(timer, currentTime);
        timer.isQueued = true;
      }
    } else {
      // Remaining timers are pending.
      return;
    }
    timer = peek(timerQueue);
  }
}

function handleTimeout(currentTime) {
  isHostTimeoutScheduled = false;
  advanceTimers(currentTime);

  if (!isHostCallbackScheduled) {
    if (peek(taskQueue) !== null) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    } else {
      const firstTimer = peek(timerQueue);
      if (firstTimer !== null) {
        requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
      }
    }
  }
}

function flushWork(hasTimeRemaining, initialTime) {
  if (enableProfiling) {
    markSchedulerUnsuspended(initialTime);
  }

  // We'll need a host callback the next time work is scheduled.
  isHostCallbackScheduled = false;
  if (isHostTimeoutScheduled) {
    // We scheduled a timeout but it's no longer needed. Cancel it.
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
  }

  isPerformingWork = true;
  const previousPriorityLevel = currentPriorityLevel;
  try {
    if (enableProfiling) {
      try {
        return workLoop(hasTimeRemaining, initialTime);
      } catch (error) {
        if (currentTask !== null) {
          const currentTime = getCurrentTime();
          markTaskErrored(currentTask, currentTime);
          currentTask.isQueued = false;
        }
        throw error;
      }
    } else {
      // No catch in prod code path.
      return workLoop(hasTimeRemaining, initialTime);
    }
  } finally {
    currentTask = null;
    currentPriorityLevel = previousPriorityLevel;
    isPerformingWork = false;
    if (enableProfiling) {
      const currentTime = getCurrentTime();
      markSchedulerSuspended(currentTime);
    }
  }
}

/**
 * workLoop 是 Scheduler 的核心循环函数，负责按优先级执行任务队列中的任务
 * @param {boolean} hasTimeRemaining - 当前时间片是否还有剩余时间
 * @param {number} initialTime - 当前的时间戳，用于计算任务是否过期
 * @returns {boolean} - 返回是否还有更多任务需要处理
 */
function workLoop(hasTimeRemaining, initialTime) {
  // 初始化当前时间为传入的初始时间
  let currentTime = initialTime;
  // 检查并将已到期的定时任务转移到任务队列
  advanceTimers(currentTime);
  // 获取任务队列中优先级最高的任务
  currentTask = peek(taskQueue);
  
  // 当任务队列不为空且调度器未被暂停时，循环处理任务
  while (
    currentTask !== null &&
    !(enableSchedulerDebugging && isSchedulerPaused)
  ) {
    // 如果当前任务还没过期，并且时间片已用完或应该让出主线程，则中断循环
    if (
      currentTask.expirationTime > currentTime &&
      (!hasTimeRemaining || shouldYieldToHost())
    ) {
      console.log('让出控制权!!!!!!!!!!!!!!!!!');
      // 这个任务还没过期，但我们已经达到了时间片的截止时间，需要让出控制权
      break;
    }
    
    // 获取任务的回调函数
    const callback = currentTask.callback;
    if (typeof callback === "function") {
      // 将任务的回调设为 null，表示正在执行
      currentTask.callback = null;
      // 设置当前优先级为任务的优先级
      currentPriorityLevel = currentTask.priorityLevel;
      // 判断任务是否已经超时
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      
      // 如果启用了性能分析，标记任务开始运行
      if (enableProfiling) {
        markTaskRun(currentTask, currentTime);
      }
      
      // 执行回调函数，并获取可能的延续回调
      const continuationCallback = callback(didUserCallbackTimeout);
      // 更新当前时间
      currentTime = getCurrentTime();
      
      // 如果回调返回一个函数，表示任务需要继续执行
      if (typeof continuationCallback === "function") {
        console.log('continuationCallback:::::::::: ', continuationCallback);
        // 将返回的函数设为新的回调，任务将在下一个时间片继续执行
        currentTask.callback = continuationCallback;
        // 如果启用了性能分析，标记任务让出控制权
        if (enableProfiling) {
          markTaskYield(currentTask, currentTime);
        }
      } else {
        // 任务已完成
        // 如果启用了性能分析，标记任务完成
        if (enableProfiling) {
          markTaskCompleted(currentTask, currentTime);
          currentTask.isQueued = false;
        }
        // 如果当前任务仍然是队列的顶部任务，将其从队列中移除
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }
      // 再次检查并将已到期的定时任务转移到任务队列
      advanceTimers(currentTime);
    } else {
      // 如果回调不是函数（可能是 null），直接从队列中移除任务
      pop(taskQueue);
    }
    // 获取下一个优先级最高的任务
    currentTask = peek(taskQueue);
  }
  
  // 返回是否还有更多任务需要处理
  if (currentTask !== null) {
    // 任务队列中还有任务，返回 true
    return true;
  } else {
    // 任务队列为空，检查定时器队列
    const firstTimer = peek(timerQueue);
    if (firstTimer !== null) {
      // 如果定时器队列中有任务，安排一个超时回调来处理它
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
    }
    // 当前没有更多任务需要立即处理
    return false;
  }
}

function unstable_runWithPriority(priorityLevel, eventHandler) {
  switch (priorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
    case LowPriority:
    case IdlePriority:
      break;
    default:
      priorityLevel = NormalPriority;
  }

  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

function unstable_next(eventHandler) {
  var priorityLevel;
  switch (currentPriorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
      // Shift down to normal priority
      priorityLevel = NormalPriority;
      break;
    default:
      // Anything lower than normal priority should remain at the current level.
      priorityLevel = currentPriorityLevel;
      break;
  }

  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

function unstable_wrapCallback(callback) {
  var parentPriorityLevel = currentPriorityLevel;
  return function () {
    // This is a fork of runWithPriority, inlined for performance.
    var previousPriorityLevel = currentPriorityLevel;
    currentPriorityLevel = parentPriorityLevel;

    try {
      return callback.apply(this, arguments);
    } finally {
      currentPriorityLevel = previousPriorityLevel;
    }
  };
}

function unstable_scheduleCallback(priorityLevel, callback, options) {
  // 获取当前时间戳
  var currentTime = getCurrentTime();
  var startTime;

  /**
   * 任务开始调度的时间。options 是一个可选参数，
   * 其中包含一个 delay 属性，表示这是一个延时任务，
   * 要延迟多少毫秒后再安排执行。
   */
  // 处理可选的选项参数
  if (typeof options === "object" && options !== null) {
    var delay = options.delay;
    if (typeof delay === "number" && delay > 0) {
      // 如果设置了延迟，则计算任务的开始时间为当前时间加上延迟时间
      startTime = currentTime + delay;
    } else {
      // 否则，任务立即开始
      startTime = currentTime;
    }
  } else {
    // 如果没有提供选项，任务立即开始
    startTime = currentTime;
  }

  /**
   * timeout 根据优先级设置，表示这个任务可以被延迟执行的最长时间。
   * 不同的优先级对应不同的超时时间。
   */
  var timeout;

  // 根据优先级设置任务的超时时间
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT; // 最高优先级
      break;
    case UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT; // 用户阻塞优先级
      break;
    case IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT; // 空闲优先级
      break;
    case LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT; // 低优先级
      break;
    case NormalPriority:
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT; // 普通优先级
      break;
  }

  /**
   * expirationTime 表示任务的过期时间。
   * 过期时间越小，任务越紧急，需要越快执行。
   */
  var expirationTime = startTime + timeout;

  /**
   * 创建一个新的任务对象。
   * sortIndex 用于任务排序，值越小的任务优先级越高。
   */
  var newTask = {
    id: taskIdCounter++, // 任务的唯一标识符
    callback, // 任务的回调函数
    priorityLevel, // 任务的优先级
    startTime, // 任务的开始时间
    expirationTime, // 任务的过期时间
    sortIndex: -1, // 用于任务排序的索引，初始为 -1
  };

  // 如果启用了性能分析，则初始化任务的队列状态
  if (enableProfiling) {
    newTask.isQueued = false;
  }

  /**
   * 如果任务有设置 delay 时间（即 startTime > currentTime），
   * 则将其放入 timerQueue 中，表示这是一个延迟执行的任务；
   * 否则，将其放入 taskQueue 中，表示这是一个立即执行的任务。
   */
  if (startTime > currentTime) {
    // 这是一个延迟任务
    newTask.sortIndex = startTime; // 使用开始时间作为排序索引，越早的任务排序越靠前
    push(timerQueue, newTask); // 将任务添加到定时器队列中

    /**
     * 检查当前是否没有其他任务在任务队列中，
     * 并且这个任务是定时器队列中最早的任务。
     * 如果是，则需要调度一个主机超时来在延迟时间后处理该任务。
     */
    if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
      if (isHostTimeoutScheduled) {
        // 如果已经有一个主机超时被调度，则取消它
        cancelHostTimeout();
      } else {
        // 标记主机超时已被调度
        isHostTimeoutScheduled = true;
      }
      // 调度一个主机超时，在延迟时间后处理任务
      requestHostTimeout(handleTimeout, startTime - currentTime);
    }
  } else {
    // 这是一个立即任务
    // 更新 sortIndex 为过期时间，这样越紧急的任务排序越靠前
    newTask.sortIndex = expirationTime; // 使用过期时间作为排序索引
    push(taskQueue, newTask); // 将任务添加到任务队列中

    if (enableProfiling) {
      // 如果启用了性能分析，标记任务的开始
      markTaskStart(newTask, currentTime);
      newTask.isQueued = true;
    }

    /**
     * 如果当前没有主机回调被调度，并且没有正在执行的工作，
     * 则调度一个主机回调来处理任务队列中的任务。
     */
    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true; // 标记主机回调已被调度
      requestHostCallback(flushWork); // 调度主机回调来刷新工作
    }
  }

  // 返回新创建的任务对象，以便调用者可以进行跟踪和管理
  return newTask;
}

function unstable_pauseExecution() {
  isSchedulerPaused = true;
}

function unstable_continueExecution() {
  isSchedulerPaused = false;
  if (!isHostCallbackScheduled && !isPerformingWork) {
    isHostCallbackScheduled = true;
    requestHostCallback(flushWork);
  }
}

function unstable_getFirstCallbackNode() {
  return peek(taskQueue);
}

function unstable_cancelCallback(task) {
  if (enableProfiling) {
    if (task.isQueued) {
      const currentTime = getCurrentTime();
      markTaskCanceled(task, currentTime);
      task.isQueued = false;
    }
  }

  // Null out the callback to indicate the task has been canceled. (Can't
  // remove from the queue because you can't remove arbitrary nodes from an
  // array based heap, only the first one.)
  task.callback = null;
}

function unstable_getCurrentPriorityLevel() {
  return currentPriorityLevel;
}

let isMessageLoopRunning = false;
let scheduledHostCallback = null;
let taskTimeoutID = -1;

// Scheduler periodically yields in case there is other work on the main
// thread, like user events. By default, it yields multiple times per frame.
// It does not attempt to align with frame boundaries, since most tasks don't
// need to be frame aligned; for those that do, use requestAnimationFrame.
let frameInterval = frameYieldMs;
const continuousInputInterval = continuousYieldMs;
const maxInterval = maxYieldMs;
let startTime = -1;

let needsPaint = false;

function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    // The main thread has only been blocked for a really short amount of time;
    // smaller than a single frame. Don't yield yet.
    return false;
  }

  // The main thread has been blocked for a non-negligible amount of time. We
  // may want to yield control of the main thread, so the browser can perform
  // high priority tasks. The main ones are painting and user input. If there's
  // a pending paint or a pending input, then we should yield. But if there's
  // neither, then we can yield less often while remaining responsive. We'll
  // eventually yield regardless, since there could be a pending paint that
  // wasn't accompanied by a call to `requestPaint`, or other main thread tasks
  // like network events.
  if (enableIsInputPending) {
    if (needsPaint) {
      // There's a pending paint (signaled by `requestPaint`). Yield now.
      return true;
    }
    if (timeElapsed < continuousInputInterval) {
      // We haven't blocked the thread for that long. Only yield if there's a
      // pending discrete input (e.g. click). It's OK if there's pending
      // continuous input (e.g. mouseover).
      if (isInputPending !== null) {
        return isInputPending();
      }
    } else if (timeElapsed < maxInterval) {
      // Yield if there's either a pending discrete or continuous input.
      if (isInputPending !== null) {
        return isInputPending(continuousOptions);
      }
    } else {
      // We've blocked the thread for a long time. Even if there's no pending
      // input, there may be some other scheduled work that we don't know about,
      // like a network event. Yield now.
      return true;
    }
  }

  // `isInputPending` isn't available. Yield now.
  return true;
}

function requestPaint() {
  if (
    enableIsInputPending &&
    navigator !== undefined &&
    navigator.scheduling !== undefined &&
    navigator.scheduling.isInputPending !== undefined
  ) {
    needsPaint = true;
  }

  // Since we yield every frame regardless, `requestPaint` has no effect.
}

function forceFrameRate(fps) {
  if (fps < 0 || fps > 125) {
    // Using console['error'] to evade Babel and ESLint
    console["error"](
      "forceFrameRate takes a positive int between 0 and 125, " +
        "forcing frame rates higher than 125 fps is not supported"
    );
    return;
  }
  if (fps > 0) {
    frameInterval = Math.floor(1000 / fps);
  } else {
    // reset the framerate
    frameInterval = frameYieldMs;
  }
}

const performWorkUntilDeadline = () => {
  if (scheduledHostCallback !== null) {
    const currentTime = getCurrentTime();
    // Keep track of the start time so we can measure how long the main thread
    // has been blocked.
    startTime = currentTime;
    const hasTimeRemaining = true;

    // If a scheduler task throws, exit the current browser task so the
    // error can be observed.
    //
    // Intentionally not using a try-catch, since that makes some debugging
    // techniques harder. Instead, if `scheduledHostCallback` errors, then
    // `hasMoreWork` will remain true, and we'll continue the work loop.
    let hasMoreWork = true;
    try {
      hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
    } finally {
      if (hasMoreWork) {
        // If there's more work, schedule the next message event at the end
        // of the preceding one.
        schedulePerformWorkUntilDeadline();
      } else {
        isMessageLoopRunning = false;
        scheduledHostCallback = null;
      }
    }
  } else {
    isMessageLoopRunning = false;
  }
  // Yielding to the browser will give it a chance to paint, so we can
  // reset this.
  needsPaint = false;
};

let schedulePerformWorkUntilDeadline;
if (typeof localSetImmediate === "function") {
  // Node.js and old IE.
  // There's a few reasons for why we prefer setImmediate.
  //
  // Unlike MessageChannel, it doesn't prevent a Node.js process from exiting.
  // (Even though this is a DOM fork of the Scheduler, you could get here
  // with a mix of Node.js 15+, which has a MessageChannel, and jsdom.)
  // https://github.com/facebook/react/issues/20756
  //
  // But also, it runs earlier which is the semantic we want.
  // If other browsers ever implement it, it's better to use it.
  // Although both of these would be inferior to native scheduling.
  schedulePerformWorkUntilDeadline = () => {
    localSetImmediate(performWorkUntilDeadline);
  };
} else if (typeof MessageChannel !== "undefined") {
  // DOM and Worker environments.
  // We prefer MessageChannel because of the 4ms setTimeout clamping.
  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  schedulePerformWorkUntilDeadline = () => {
    port.postMessage(null);
  };
} else {
  // We should only fallback here in non-browser environments.
  schedulePerformWorkUntilDeadline = () => {
    localSetTimeout(performWorkUntilDeadline, 0);
  };
}

function requestHostCallback(callback) {
  scheduledHostCallback = callback;
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    schedulePerformWorkUntilDeadline();
  }
}

function requestHostTimeout(callback, ms) {
  taskTimeoutID = localSetTimeout(() => {
    callback(getCurrentTime());
  }, ms);
}

function cancelHostTimeout() {
  localClearTimeout(taskTimeoutID);
  taskTimeoutID = -1;
}

const unstable_requestPaint = requestPaint;

export {
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  NormalPriority as unstable_NormalPriority,
  IdlePriority as unstable_IdlePriority,
  LowPriority as unstable_LowPriority,
  unstable_runWithPriority,
  unstable_next,
  unstable_scheduleCallback,
  unstable_cancelCallback,
  unstable_wrapCallback,
  unstable_getCurrentPriorityLevel,
  shouldYieldToHost as unstable_shouldYield,
  unstable_requestPaint,
  unstable_continueExecution,
  unstable_pauseExecution,
  unstable_getFirstCallbackNode,
  getCurrentTime as unstable_now,
  forceFrameRate as unstable_forceFrameRate,
  unstable_setDisableYieldValue,
  unstable_yieldValue,
};

export const unstable_Profiling = enableProfiling
  ? {
      startLoggingProfilingEvents,
      stopLoggingProfilingEvents,
    }
  : null;
