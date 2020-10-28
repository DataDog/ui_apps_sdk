import Postmate from 'postmate';

import { CapabilityManager } from './capabilites/capabilityManager';
import { capabilityManagers } from './capabilites';
import {
    Host,
    UiAppCapabilityType,
    UiAppEventToSubscribeType,
    UiAppEventToTriggerType
} from './constants';
import { getLogger, Logger } from './logger';
import {
    AppContext,
    EventHandler,
    HandleEventParams,
    ClientOptions
} from './types';
import { Deferred, defer } from './utils';

const DEFAULT_OPTIONS = {
    host: Host.STAGE,
    debug: false
};

export class DDClient {
    private readonly host: string;
    private readonly debug: boolean;
    private readonly handshake: Postmate.Model;
    private readonly logger: Logger;
    private context: Deferred<AppContext>;
    private capabilityManagers: CapabilityManager[];

    constructor(options: ClientOptions = {}) {
        this.host = options.host || DEFAULT_OPTIONS.host;
        this.debug = options.debug || DEFAULT_OPTIONS.debug;
        this.context = defer();
        this.logger = getLogger(options);

        // @ts-ignore
        Postmate.debug = this._debug;

        this.handshake = new Postmate.Model({
            init: (context: AppContext) => this.init(context),
            handleEvent: (params: HandleEventParams) => this.handleEvent(params)
        });

        this.capabilityManagers = capabilityManagers.map(
            Manager =>
                new Manager(
                    { host: this.host, debug: this.debug },
                    this.handshake,
                    this.context
                )
        );

        this.capabilityManagers.forEach(manager =>
            manager.applyAdditionalMethods(this)
        );
    }

    /**
     * Adds event handler to execute on a certain event type from the parent. Will print
     * an error if the installed app does not have the required capability. Returns an unsubscribe
     * method. This method can be called before handshake is successful, but handlers will not execute until
     * after successsful handshake.
     */
    on<T = any>(
        eventType: UiAppEventToSubscribeType,
        handler: EventHandler<T>
    ): () => void {
        const manager = this.getManagerByEventToSubscribeType(eventType);

        if (!manager) {
            this.logger.error('Unknown event type');

            return () => {};
        }

        return manager.subscribeHandler<T>(eventType, handler);
    }

    /**
     * Triggers an event type to be handled in the parent. Will print
     * an error if the installed app does not have the required capability.
     * This method can be called before handshake is successful, but handlers will not execute until
     * after successsful handshake.
     */

    triggerEvent(eventType: UiAppEventToTriggerType, data: any = {}) {
        const manager = this.getManagerByEventToTriggerType(eventType);
        if (!manager) {
            this.logger.error('Unknown event type');
        } else {
            manager.triggerEvent(eventType, data);
        }
    }

    /**
     * Returns app context data, after it is sent from the parent
     */
    async getContext(): Promise<AppContext> {
        return this.context.promise;
    }

    /**
     * syntactic sugar trigger UiAppEventToTriggerType.RELOAD_FRAME which reloads the current child frame and re-initiate the handshake with the parent
     */
    reloadFrame() {
        this.triggerEvent(UiAppEventToTriggerType.RELOAD_FRAME);
    }

    /**
     * Reloads the current child frame and re-initiate the handshake with the parent
     */
    async loadFrameWithURL(url: string) {
        const parent = await this.handshake;
        parent.emit('loadFrameWithURL', url);
    }

    /**
     * init method is exposed in the postmate model. It must be called before other operations may proceed,
     * in order to inform client of app context
     */
    private async init(context: AppContext) {
        // parent should only be able to call this after handshake is complete, but its worth a check anyways
        await this.handshake;

        this.context.resolve(context);

        this.logger.log(
            'dd-apps: sdk handshake: parent <-> child handshake is complete'
        );
    }

    /**
     * handleEvent is the main method called by the parent through postmate (child.handleEvent('exec', {...})).
     * It accepts a keyed event type and arbitrary data to be passed to event handlers. It will log an error
     * message if the user does not have the required capability enabled
     */
    private async handleEvent<T>({ eventType, data }: HandleEventParams<T>) {
        const manager = this.getManagerByEventToSubscribeType(eventType);

        if (!manager) {
            this.logger.error(
                'Could not handle event: no corresponding manager found'
            );

            return;
        }

        manager.handleEvent({ eventType, data });
    }

    private getManagerByType(
        capabilityType: UiAppCapabilityType
    ): CapabilityManager | undefined {
        return this.capabilityManagers.find(
            manager => manager.type === capabilityType
        );
    }

    private getManagerByEventToSubscribeType(
        eventType: UiAppEventToSubscribeType
    ): CapabilityManager | undefined {
        return this.capabilityManagers.find(manager =>
            manager.eventsToSubscribe.includes(eventType)
        );
    }

    private getManagerByEventToTriggerType(
        eventType: UiAppEventToTriggerType
    ): CapabilityManager | undefined {
        return this.capabilityManagers.find(manager =>
            manager.eventsToTrigger.includes(eventType)
        );
    }
}
