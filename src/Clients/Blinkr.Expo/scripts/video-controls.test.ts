import { formatClock, nextRate, PLAYBACK_RATES, progressOf, rateLabel, seekTarget } from '../src/videoControls';

const check = (name: string, ok: boolean) => { if (!ok) throw new Error(`FAIL ${name}`); console.log(`PASS ${name}`); };
check('speed cycles 1 -> 1.25 -> 1.5 -> 2 -> 0.5 -> 1', PLAYBACK_RATES.reduce<number[]>((acc) => [...acc, nextRate(acc[acc.length - 1])], [1]).join() === '1,1.25,1.5,2,0.5,1');
check('unknown speed falls back to the first', nextRate(3) === 1);
check('speed labels', rateLabel(1) === '1x' && rateLabel(1.5) === '1.5x' && rateLabel(0.5) === '0.5x');
check('clock formats minutes and hours', formatClock(7) === '0:07' && formatClock(65) === '1:05' && formatClock(3729) === '1:02:09');
check('clock never shows NaN or negatives', formatClock(NaN) === '0:00' && formatClock(-4) === '0:00');
check('seek is clamped to the video', seekTarget(50, 100, 30) === 15 && seekTarget(-10, 100, 30) === 0 && seekTarget(200, 100, 30) === 30);
check('seek waits for a known size and duration', seekTarget(50, 0, 30) === 0 && seekTarget(50, 100, 0) === 0);
check('progress is 0..1', progressOf(5, 10) === 0.5 && progressOf(20, 10) === 1 && progressOf(5, 0) === 0);
