import { useState, useRef } from 'react';
import { useGesture } from '@use-gesture/react';

export const useTrackpadGesture = (
    send: (msg: any) => void,
    scrollMode: boolean,
    sensitivity: number = 1.5
) => {
    const [isTracking, setIsTracking] = useState(false);
    
    const maxTouches = useRef(0);
    const swipeAccumulator = useRef({ x: 0, y: 0 });
    const SWIPE_THRESHOLD = 100;

    const handlers = useGesture({
        onPointerDown: ({ touches }) => {
            maxTouches.current = touches;
            swipeAccumulator.current = { x: 0, y: 0 };
        },
        onDragStart: ({ touches }) => {
            setIsTracking(true);
            maxTouches.current = Math.max(maxTouches.current, touches);
        },
        onDrag: ({ delta: [dx, dy], touches, event }) => {
            if (event.cancelable) event.preventDefault();
            
            maxTouches.current = Math.max(maxTouches.current, touches);
            
            if (touches === 1 && !scrollMode) {
                 send({ type: 'move', dx: dx * sensitivity, dy: dy * sensitivity });
            } 
            else if (touches === 2 || (touches === 1 && scrollMode)) {
                 const scrollSens = sensitivity * 2.5; 
                 send({ type: 'scroll', dx: -dx * scrollSens, dy: -dy * scrollSens });
            }
            else if (touches === 3) {
                swipeAccumulator.current.x += dx;
                swipeAccumulator.current.y += dy;

                if (Math.abs(swipeAccumulator.current.x) > SWIPE_THRESHOLD) {
                    const dir = swipeAccumulator.current.x > 0 ? 'right' : 'left';
                    send({ type: 'swipe', direction: dir });
                    swipeAccumulator.current = { x: 0, y: 0 };
                }
                if (Math.abs(swipeAccumulator.current.y) > SWIPE_THRESHOLD) {
                    const dir = swipeAccumulator.current.y > 0 ? 'down' : 'up';
                    send({ type: 'swipe', direction: dir });
                    swipeAccumulator.current = { x: 0, y: 0 };
                }
            }
        },
        onDragEnd: ({ tap }) => {
             setIsTracking(false);
             if (tap) {
                 const button = maxTouches.current === 2 ? 'right' : 'left';
                 send({ type: 'click', button, press: true });
                 setTimeout(() => send({ type: 'click', button, press: false }), 50);
             }
             maxTouches.current = 0;
             swipeAccumulator.current = { x: 0, y: 0 };
        },
        onPinch: ({ delta: [d], event }) => {
             if (event.cancelable) event.preventDefault();
             
             if (d !== 0) {
                // FIX: Removed negative sign. Positive d = Zoom In.
                send({ type: 'zoom', delta: d * 100 }); 
             }
        },
        onPinchStart: () => setIsTracking(true),
        onPinchEnd: () => setIsTracking(false)
    }, {
        drag: { filterTaps: true, threshold: 3 },
        pinch: { scaleBounds: { min: 0.1, max: 10 }, rubberband: true },
        eventOptions: { passive: false } 
    });

    return {
        isTracking,
        handlers: handlers()
    };
};
