import { ActiveTimer, Task } from './types';

/** Elapsed time of a timer session, honouring pauses. */
export function timerElapsedMs(timer: ActiveTimer, nowMs: number): number {
  const running = timer.paused ? 0 : nowMs - new Date(timer.startedAt).getTime();
  return Math.max(0, timer.accumulatedMs + running);
}

export function liveMinutesFor(task: Task, activeTimer: ActiveTimer | null, nowMs: number): number {
  if (!activeTimer || activeTimer.taskId !== task.id) return task.minutes;
  return task.minutes + Math.floor(timerElapsedMs(activeTimer, nowMs) / 60000);
}

export function taskAmount(task: Task, liveMinutes: number): number {
  return task.rateType === 'hourly' ? task.rate * (liveMinutes / 60) : task.rate;
}
