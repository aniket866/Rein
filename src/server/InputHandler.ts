import { mouse, Point, Button, keyboard, Key } from '@nut-tree-fork/nut-js';
import { KEY_MAP } from './KeyMap';
import { CONFIG } from '../config';

export interface InputMessage {
    type: 'move' | 'click' | 'scroll' | 'key' | 'text' | 'zoom' | 'swipe';
    dx?: number;
    dy?: number;
    button?: 'left' | 'right' | 'middle';
    press?: boolean;
    key?: string;
    text?: string;
    delta?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
}

export class InputHandler {
    constructor() {
        mouse.config.mouseSpeed = 1000;
    }

    async handleMessage(msg: InputMessage) {
        try {
            switch (msg.type) {
                case 'move':
                    if (msg.dx !== undefined && msg.dy !== undefined) {
                        const currentPos = await mouse.getPosition();
                        const sensitivity = CONFIG.MOUSE_SENSITIVITY ?? 1.0;
                        await mouse.setPosition(new Point(
                            currentPos.x + (msg.dx * sensitivity), 
                            currentPos.y + (msg.dy * sensitivity)
                        ));
                    }
                    break;

                case 'click':
                    if (msg.button) {
                        const btn = msg.button === 'left' ? Button.LEFT : msg.button === 'right' ? Button.RIGHT : Button.MIDDLE;
                        if (msg.press) {
                            await mouse.pressButton(btn);
                        } else {
                            await mouse.releaseButton(btn);
                        }
                    }
                    break;

                case 'scroll':
                    const invert = (CONFIG.MOUSE_INVERT ?? false) ? -1 : 1;
                    if (msg.dy) {
                        const amount = msg.dy * invert;
                        // Lower threshold to catch smaller scrolls
                        if (Math.abs(amount) >= 0.1) {
                            await mouse.scrollDown(amount);
                        }
                    }
                    if (msg.dx) {
                        const amount = msg.dx * -1 * invert;
                        if (Math.abs(amount) >= 0.1) {
                            await mouse.scrollRight(amount);
                        }
                    }
                    break;

                case 'zoom':
                    if (msg.delta !== undefined && msg.delta !== 0) {
                        const invert = (CONFIG.MOUSE_INVERT ?? false) ? -1 : 1;
                        // Simple zoom logic: ctrl + scroll
                        const direction = Math.sign(msg.delta);
                        // Ensure we scroll at least 1 tick
                        const amount = direction * Math.max(1, Math.abs(Math.round(msg.delta))) * invert;

                        await keyboard.pressKey(Key.LeftControl);
                        try {
                            await mouse.scrollDown(amount);
                        } finally {
                            await keyboard.releaseKey(Key.LeftControl);
                        }
                    }
                    break;

                case 'swipe':
                    // Map 3-finger swipes to common OS shortcuts
                    console.log('Processing Swipe:', msg.direction);
                    if (msg.direction === 'left') {
                        // Switch Desktop Left (Win+Ctrl+Left is common on Windows, Ctrl+Left on Mac)
                        // Using Win+Left as a generic placeholder or Win+Tab for task view
                        await keyboard.pressKey(Key.LeftSuper);
                        await keyboard.pressKey(Key.LeftControl);
                        await keyboard.type(Key.Left);
                        await keyboard.releaseKey(Key.LeftControl);
                        await keyboard.releaseKey(Key.LeftSuper);
                    } else if (msg.direction === 'right') {
                        await keyboard.pressKey(Key.LeftSuper);
                        await keyboard.pressKey(Key.LeftControl);
                        await keyboard.type(Key.Right);
                        await keyboard.releaseKey(Key.LeftControl);
                        await keyboard.releaseKey(Key.LeftSuper);
                    } else if (msg.direction === 'up') {
                        // Task View (Win+Tab)
                        await keyboard.pressKey(Key.LeftSuper);
                        await keyboard.type(Key.Tab);
                        await keyboard.releaseKey(Key.LeftSuper);
                    } else if (msg.direction === 'down') {
                        // Show Desktop (Win+D)
                        await keyboard.pressKey(Key.LeftSuper);
                        await keyboard.type(Key.D);
                        await keyboard.releaseKey(Key.LeftSuper);
                    }
                    break;

                case 'key':
                    if (msg.key) {
                        const nutKey = KEY_MAP[msg.key.toLowerCase()];
                        if (nutKey !== undefined) {
                            await keyboard.type(nutKey);
                        } else if (msg.key.length === 1) {
                            await keyboard.type(msg.key);
                        }
                    }
                    break;

                case 'text':
                    if (msg.text) await keyboard.type(msg.text);
                    break;
            }
        } catch (error) {
            console.error('Input Handling Error:', error);
        }
    }
}
