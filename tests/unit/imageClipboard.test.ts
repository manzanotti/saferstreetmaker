import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPngClipboardWriter } from '../../src/features/export/imageClipboard';

class TestClipboardItem {
    constructor(readonly data: Record<string, Blob | Promise<Blob>>) {}
}

describe('PNG clipboard writer', () => {
    const write = vi.fn();
    let originalClipboard: PropertyDescriptor | undefined;

    beforeEach(() => {
        originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        vi.stubGlobal('isSecureContext', true);
        vi.stubGlobal('ClipboardItem', TestClipboardItem);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { write }
        });
        write.mockReset().mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        if (originalClipboard) {
            Object.defineProperty(navigator, 'clipboard', originalClipboard);
        } else {
            Reflect.deleteProperty(navigator, 'clipboard');
        }
    });

    it('starts the clipboard write immediately with the promised PNG', async () => {
        let finish: (blob: Blob) => void = () => {
            throw new Error('Image promise was not created');
        };
        const image = new Promise<Blob>((resolve) => {
            finish = resolve;
        });

        const writing = getPngClipboardWriter()(image);
        expect(write).toHaveBeenCalledOnce();
        const [item] = write.mock.calls[0][0] as TestClipboardItem[];
        expect(item.data['image/png']).toBe(image);
        finish(new Blob(['png'], { type: 'image/png' }));
        await expect(writing).resolves.toBeUndefined();
    });

    it('explains when image clipboard access is unavailable', () => {
        vi.stubGlobal('isSecureContext', false);
        expect(() => getPngClipboardWriter()).toThrow('secure connection');
        vi.stubGlobal('isSecureContext', true);
        vi.stubGlobal('ClipboardItem', undefined);
        expect(() => getPngClipboardWriter()).toThrow('image clipboard access');
        vi.stubGlobal('ClipboardItem', TestClipboardItem);
        Reflect.deleteProperty(navigator, 'clipboard');
        expect(() => getPngClipboardWriter()).toThrow('image clipboard access');
        expect(write).not.toHaveBeenCalled();
    });

    it('reports denied and synchronous clipboard failures', async () => {
        const image = Promise.resolve(new Blob(['png'], { type: 'image/png' }));
        write.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
        await expect(getPngClipboardWriter()(image)).rejects.toThrow('Clipboard access was denied');

        write.mockImplementationOnce(() => {
            throw new Error('Clipboard unavailable');
        });
        expect(() => getPngClipboardWriter()(image)).toThrow('Clipboard unavailable');
    });
});
