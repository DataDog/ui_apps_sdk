import { init } from '..';

import { UiAppEventType } from '../constants';
import { MockFramePostChildClient, mockContext } from '../utils/testUtils';

import { DDClient } from './client';

let mockClient: MockFramePostChildClient;

jest.mock('@datadog/framepost', () => ({
    ChildClient: class {
        constructor() {
            return mockClient;
        }
    }
}));

beforeEach(() => {
    mockClient = new MockFramePostChildClient();
});

describe('client', () => {
    test('instantiates without error', () => {
        const client = new DDClient();

        expect(client).toBeInstanceOf(Object);
    });
});

describe('client.getContext()', () => {
    test('returns app context after it is supplied from parent', async () => {
        const client = new DDClient();

        mockClient.init();

        const context = await client.getContext();

        expect(context).toBe(mockContext);
    });

    test('updates returned context data on context_change event', async () => {
        const client = new DDClient();

        mockClient.init();

        mockClient.mockEvent(UiAppEventType.CONTEXT_CHANGE, {
            data: 'new context'
        });

        const context = await client.getContext();

        expect(context).toEqual({
            data: 'new context'
        });
    });
});

describe('sdk init method', () => {
    test('returns a client instance', () => {
        const client = init();

        expect(client).toBeInstanceOf(DDClient);
    });

    test('does not re-instantiate client if called again', () => {
        const client = init();

        const clientAgain = init();

        expect(clientAgain).toBe(client);
    });
});
