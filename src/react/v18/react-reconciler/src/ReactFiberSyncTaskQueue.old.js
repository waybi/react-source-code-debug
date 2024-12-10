/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { SchedulerCallback } from "./Scheduler";

import {
  DiscreteEventPriority,
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
} from "./ReactEventPriorities.old";
import { ImmediatePriority, scheduleCallback } from "./Scheduler";

let syncQueue: Array<SchedulerCallback> | null = null;
let includesLegacySyncCallbacks: boolean = false;
let isFlushingSyncQueue: boolean = false;

export function scheduleSyncCallback(callback: SchedulerCallback) {
  // Push this callback into an internal queue. We'll flush these either in
  // the next tick, or earlier if something calls `flushSyncCallbackQueue`.
  if (syncQueue === null) {
    syncQueue = [callback];
  } else {
    // Push onto existing queue. Don't need to schedule a callback because
    // we already scheduled one when we created the queue.
    syncQueue.push(callback);
  }
}

export function scheduleLegacySyncCallback(callback: SchedulerCallback) {
  includesLegacySyncCallbacks = true;
  scheduleSyncCallback(callback);
}

export function flushSyncCallbacksOnlyInLegacyMode() {
  // Only flushes the queue if there's a legacy sync callback scheduled.
  // TODO: There's only a single type of callback: performSyncOnWorkOnRoot. So
  // it might make more sense for the queue to be a list of roots instead of a
  // list of generic callbacks. Then we can have two: one for legacy roots, one
  // for concurrent roots. And this method would only flush the legacy ones.
  if (includesLegacySyncCallbacks) {
    flushSyncCallbacks();
  }
}

export function flushSyncCallbacks() {
  // 如果当前没有在刷新同步队列，并且同步队列不为空
  if (!isFlushingSyncQueue && syncQueue !== null) {
    // 防止重新进入该函数
    isFlushingSyncQueue = true;
    let i = 0;
    // 保存当前的更新优先级
    const previousUpdatePriority = getCurrentUpdatePriority();
    try {
      const isSync = true; // 标识这是一个同步操作
      const queue = syncQueue; // 获取当前的同步队列
      // 将当前更新优先级设置为离散事件优先级
      setCurrentUpdatePriority(DiscreteEventPriority);
      // 逐个执行队列中的回调函数
      for (; i < queue.length; i++) {
        let callback = queue[i];
        // 如果回调函数返回新的回调，则继续执行
        do {
          callback = callback(isSync);
        } while (callback !== null);
      }
      // 清空同步队列
      syncQueue = null;
      includesLegacySyncCallbacks = false;
    } catch (error) {
      // 如果执行过程中抛出错误，将剩余的回调保留在队列中
      if (syncQueue !== null) {
        syncQueue = syncQueue.slice(i + 1);
      }
      // 在下一个 tick 中恢复刷新
      scheduleCallback(ImmediatePriority, flushSyncCallbacks);
      throw error;
    } finally {
      // 恢复之前的更新优先级
      setCurrentUpdatePriority(previousUpdatePriority);
      // 标记同步队列刷新完成
      isFlushingSyncQueue = false;
    }
  }
  return null;
}
