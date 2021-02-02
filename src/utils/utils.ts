import { UiAppEventType, UiAppFeatureType, enabledEvents } from '../constants';
import { features } from '../features';
import type { DefinitionWithKey } from '../types';

const memoize = <T>(getter: () => T): (() => T) => {
    let executed = false;
    let value: T;

    return () => {
        if (!executed) {
            value = getter();
            executed = true;
        }

        return value;
    };
};

export const isFeatureEnabled = (
    feature: UiAppFeatureType,
    enabledFeatures: UiAppFeatureType[]
): boolean => enabledFeatures.includes(feature);

export const getFeatureTypesByEvent = memoize(
    (): Map<UiAppEventType, Set<UiAppFeatureType>> => {
        const featureTypesByEvent = new Map<
            UiAppEventType,
            Set<UiAppFeatureType>
        >();

        features.forEach(feature => {
            feature.events.forEach((e: UiAppEventType) => {
                if (!featureTypesByEvent.has(e)) {
                    featureTypesByEvent.set(e, new Set());
                }

                featureTypesByEvent.get(e)!.add(feature.type);
            });
        });

        return featureTypesByEvent;
    }
);

export const isEventEnabled = (
    event: UiAppEventType,
    enabledFeatures: UiAppFeatureType[]
): boolean => {
    if (enabledEvents.has(event)) {
        return true;
    }

    const featureTypesByEvent = getFeatureTypesByEvent();

    // get the set of features that enable this event
    const enablingFeatures = featureTypesByEvent.get(event as UiAppEventType);

    // if no enabling feature found, event is unknown
    if (!enablingFeatures) {
        return false;
    }

    return enabledFeatures.some(feature => enablingFeatures.has(feature));
};

export const isDefinitionWithKey = (
    defenition: any
): defenition is DefinitionWithKey => !!defenition.key;

export const validateKey = <T = any>(definitionOrKey: T | string): boolean => {
    if (typeof definitionOrKey === 'string') {
        return definitionOrKey.length > 0;
    }

    const definition = definitionOrKey as T;

    if (!isDefinitionWithKey(definition)) {
        throw new Error('Definition missing required field ".key"');
    }

    return true;
};

/**
 * Typescript utility type, takes an interface and makes the specified keys required
 * Example: RequireKeys<MyType, 'a' | 'b'>
 */
export type RequireKeys<T, K extends keyof T> = {
    [X in Exclude<keyof T, K>]?: T[X];
} &
    {
        [P in K]-?: T[P];
    };
